-- Reviewed custom migration: authority, transactional invariants, RLS and grants.
-- Tables stay migration-owned. Routines are owned by a dedicated non-login role.
DO $$ DECLARE role_name text; BEGIN
 FOREACH role_name IN ARRAY ARRAY['ourhoomu_core_writer','ourhoomu_core_app','ourhoomu_core_auth'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',role_name);END IF;
 END LOOP;END $$;
DO $$ BEGIN EXECUTE format('GRANT ourhoomu_core_writer TO %I',current_user); END $$;
GRANT CREATE ON SCHEMA core TO ourhoomu_core_writer;
GRANT USAGE ON SCHEMA core TO ourhoomu_core_writer, ourhoomu_core_app, ourhoomu_core_auth;
REVOKE ALL ON SCHEMA core FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO ourhoomu_core_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA core REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER TABLE core.payment_confirmations ADD CONSTRAINT confirmation_activity_tuple UNIQUE(house_id,bill_id,id);
ALTER TABLE core.activity_events ADD CONSTRAINT activity_confirmation_fk FOREIGN KEY(house_id,bill_id,confirmation_id) REFERENCES core.payment_confirmations(house_id,bill_id,id);
ALTER TABLE core.sessions ADD CONSTRAINT session_generation_unique UNIQUE(family_id,generation);
CREATE UNIQUE INDEX account_one_default ON core.recipient_accounts(owner_user_id) WHERE is_default AND state='active';
ALTER TABLE core.chore_schedules ADD CONSTRAINT schedule_active_revision_fk FOREIGN KEY(house_id,id,active_revision) REFERENCES core.chore_revisions(house_id,schedule_id,revision) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE core.auth_identities ADD CONSTRAINT identity_user_tuple UNIQUE(id,user_id);
ALTER TABLE core.sessions ADD CONSTRAINT identity_user_unique_guard FOREIGN KEY(identity_id,user_id) REFERENCES core.auth_identities(id,user_id);

-- Every composite FK has a supporting leading-column B-tree, without duplicating existing indexes.
DO $$ DECLARE fk record; cols text; BEGIN
 FOR fk IN SELECT c.oid,c.conname,c.conrelid,c.conkey,t.relname FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid=c.conrelid WHERE c.contype='f' AND c.connamespace='core'::regnamespace LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_index i WHERE i.indrelid=fk.conrelid AND i.indpred IS NULL AND i.indisvalid AND (SELECT array_agg(x.att ORDER BY x.ord) FROM unnest(i.indkey::smallint[]) WITH ORDINALITY x(att,ord) WHERE x.ord<=cardinality(fk.conkey))=fk.conkey) THEN
   SELECT string_agg(format('%I',a.attname),',' ORDER BY k.ord) INTO cols FROM unnest(fk.conkey) WITH ORDINALITY k(att,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=k.att;
   EXECUTE format('CREATE INDEX %I ON core.%I (%s)','fk_'||md5(fk.conname),fk.relname,cols);
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION core.fail(code text, current_version integer DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE=code, DETAIL=CASE WHEN code='version_conflict' THEN current_version::text ELSE '' END; END $$;

CREATE FUNCTION core.actor() RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid; sid uuid;
BEGIN
 uid:=nullif(current_setting('ourhoomu.user_id',true),'')::uuid;
 sid:=nullif(current_setting('ourhoomu.session_id',true),'')::uuid;
 IF uid IS NULL OR sid IS NULL OR NOT EXISTS(
   SELECT 1 FROM core.sessions s JOIN core.users u ON u.id=s.user_id
   WHERE s.id=sid AND s.user_id=uid AND u.state='active' AND s.revoked_at IS NULL AND s.rotated_at IS NULL
    AND s.expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM core.sessions r WHERE r.family_id=s.family_id AND r.revoked_at IS NOT NULL)
 ) THEN RETURN NULL; END IF;
 RETURN uid;
END $$;

CREATE FUNCTION core.member(h uuid) RETURNS uuid LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT m.id FROM core.house_memberships m JOIN core.houses x ON x.id=m.house_id
 WHERE m.house_id=h AND m.user_id=core.actor() AND m.state='active' AND x.state='active'
$$;
CREATE FUNCTION core.require_member(h uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid;
BEGIN
 IF core.actor() IS NULL THEN PERFORM core.fail('unauthenticated'); END IF;
 -- All household writes serialize here before inspecting any child or idempotency locator.
 PERFORM 1 FROM core.houses WHERE id=h FOR UPDATE;
 m:=core.member(h);
 IF m IS NULL THEN PERFORM core.fail('not_found'); END IF;
 RETURN m;
END $$;
CREATE FUNCTION core.expect_version(actual integer, expected integer) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN IF expected IS NULL OR expected<1 THEN PERFORM core.fail('validation_error'); END IF;
 IF actual<>expected THEN PERFORM core.fail('version_conflict',actual); END IF; END $$;
CREATE FUNCTION core.require_live(expiry timestamptz) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN IF expiry<=clock_timestamp() THEN PERFORM core.fail('expired'); END IF; END $$;

CREATE FUNCTION core.emit(h uuid,m uuid,kind text,b uuid DEFAULT NULL,c uuid DEFAULT NULL,credit uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE e timestamptz:=statement_timestamp()+interval '8736 hours'; d timestamptz:=statement_timestamp()+interval '8760 hours';
BEGIN
 IF b IS NOT NULL THEN SELECT least(e,expires_at),least(d,retention_deadline_at) INTO e,d FROM core.bills WHERE house_id=h AND id=b; END IF;
 IF c IS NOT NULL THEN SELECT least(e,expires_at),least(d,retention_deadline_at) INTO e,d FROM core.chore_occurrences WHERE house_id=h AND id=c; END IF;
 PERFORM core.require_live(e);
 INSERT INTO core.activity_events(house_id,actor_membership_id,event_type,bill_id,occurrence_id,confirmation_id,expires_at,retention_deadline_at) VALUES(h,m,kind,b,c,credit,e,d);
END $$;

CREATE FUNCTION core.command(op text,h uuid,rid uuid,p jsonb,k text,bh text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
 uid uuid:=core.actor(); m uuid; role_name text; result_id uuid; result_kind text;
 n timestamptz:=statement_timestamp(); e timestamptz; d timestamptz;
 scope text; old core.idempotency_records; b core.bills; a core.recipient_accounts; pay core.payment_attempts;
 sh core.bill_shares; occ core.chore_occurrences; sched core.chore_schedules; rev core.chore_revisions;
 inv core.house_invitations; target core.house_memberships;
 recipient core.house_memberships; item jsonb; mid uuid; total_bps integer; amount bigint;
 credited numeric; reserved numeric; credit_id uuid; remainder_count integer; rule jsonb;
 days integer; gen_date date; local_today date; selected uuid; ordinal bigint; pool_size integer; day_start date;
 replay_cipher text; replay_until timestamptz;
BEGIN
 IF uid IS NULL THEN PERFORM core.fail('unauthenticated'); END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR k !~ '^[0-9a-f]{64}$' OR bh !~ '^[0-9a-f]{64}$' THEN PERFORM core.fail('validation_error'); END IF;
 e:=n+interval '24 hours'; d:=e+interval '24 hours';
 IF op IN ('house.create','account.create','account.update','account.archive','session.revoke') THEN
  -- User lock gives non-house commands one fixed scope, before idempotency.
  PERFORM 1 FROM core.users WHERE id=uid FOR UPDATE;
  h:=NULL;
 ELSIF op='invite.accept' THEN
  SELECT * INTO inv FROM core.house_invitations WHERE token_digest=p->>'tokenDigest';
  IF inv.id IS NULL THEN PERFORM core.fail('invite_unavailable'); END IF;
  h:=inv.house_id;
  PERFORM 1 FROM core.houses WHERE id=h AND state='active' FOR UPDATE;
  IF NOT FOUND THEN PERFORM core.fail('invite_unavailable'); END IF;
  SELECT * INTO inv FROM core.house_invitations WHERE house_id=h AND id=inv.id FOR UPDATE;
  IF inv.revoked_at IS NOT NULL OR inv.expires_at<=clock_timestamp() OR (inv.consumed_at IS NOT NULL AND inv.consumed_by_user_id<>uid) THEN PERFORM core.fail('invite_unavailable'); END IF;
  e:=inv.expires_at;d:=inv.retention_deadline_at;
 ELSE
  m:=core.require_member(h);
  SELECT role INTO role_name FROM core.house_memberships WHERE house_id=h AND id=m;
 END IF;

 -- Scope and authority checks precede replay; resource locators never authorize a viewer.
 IF op IN ('bill.update','bill.publish','bill.void','payment.reserve') THEN
  SELECT * INTO b FROM core.bills WHERE house_id=h AND id=rid FOR UPDATE;
  IF b.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
  PERFORM core.require_live(b.expires_at); e:=b.expires_at;d:=b.retention_deadline_at;
  IF op<>'payment.reserve' AND b.creator_membership_id<>m THEN PERFORM core.fail('forbidden'); END IF;
  IF op='payment.reserve' THEN
   SELECT * INTO sh FROM core.bill_shares WHERE house_id=h AND bill_id=b.id AND membership_id=m FOR UPDATE;
   IF sh.membership_id IS NULL OR sh.self_covered THEN PERFORM core.fail('forbidden'); END IF;
  END IF;
 ELSIF op IN ('cash.confirm','cash.reject','payment.cancel') THEN
  -- Resolve minimally under live membership, then lock canonical parent -> share -> attempt.
  SELECT * INTO pay FROM core.payment_attempts WHERE house_id=h AND id=rid;
  IF pay.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
  SELECT * INTO b FROM core.bills WHERE house_id=h AND id=pay.bill_id FOR UPDATE;
  PERFORM core.require_live(b.expires_at);
  SELECT * INTO sh FROM core.bill_shares WHERE house_id=h AND bill_id=b.id AND membership_id=pay.payer_membership_id FOR UPDATE;
  SELECT * INTO pay FROM core.payment_attempts WHERE house_id=h AND id=rid FOR UPDATE;
  PERFORM core.require_live(pay.expires_at); e:=pay.expires_at;d:=pay.retention_deadline_at;
  IF op IN ('cash.confirm','cash.reject') AND (b.creator_membership_id<>m OR pay.method<>'cash') THEN PERFORM core.fail('forbidden'); END IF;
  IF op='payment.cancel' AND pay.payer_membership_id<>m THEN PERFORM core.fail('forbidden'); END IF;
 ELSIF op IN ('chore.complete','chore.reopen','chore.cancel','chore.update') THEN
  SELECT * INTO occ FROM core.chore_occurrences WHERE house_id=h AND id=rid;
  IF occ.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
  IF occ.schedule_id IS NOT NULL THEN PERFORM 1 FROM core.chore_schedules WHERE house_id=h AND id=occ.schedule_id FOR UPDATE; END IF;
  SELECT * INTO occ FROM core.chore_occurrences WHERE house_id=h AND id=rid FOR UPDATE;
  PERFORM core.require_live(occ.expires_at); e:=occ.expires_at;d:=occ.retention_deadline_at;
  IF op IN ('chore.complete','chore.reopen') AND occ.assignee_membership_id IS DISTINCT FROM m THEN PERFORM core.fail('forbidden'); END IF;
  IF op IN ('chore.cancel','chore.update') AND occ.creator_membership_id<>m AND role_name<>'owner' THEN PERFORM core.fail('forbidden'); END IF;
 ELSIF op IN ('schedule.generate','schedule.update','schedule.archive') THEN
  SELECT * INTO sched FROM core.chore_schedules WHERE house_id=h AND id=rid FOR UPDATE;
  IF sched.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
  IF sched.creator_membership_id<>m AND role_name<>'owner' THEN PERFORM core.fail('forbidden'); END IF;
 ELSIF op IN ('account.update','account.archive') THEN
  SELECT * INTO a FROM core.recipient_accounts WHERE id=rid AND owner_user_id=uid FOR UPDATE;
  IF a.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
 ELSIF op IN ('invite.create','invite.revoke','member.remove','member.role','house.update') THEN
  IF role_name<>'owner' THEN PERFORM core.fail('forbidden'); END IF;
 END IF;
 IF op IN ('member.leave','member.remove','member.role') THEN
  IF op='member.leave' THEN rid:=m; END IF;
  SELECT * INTO target FROM core.house_memberships WHERE house_id=h AND id=rid FOR UPDATE;
  IF target.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
 END IF;
 IF op='invite.revoke' THEN
  SELECT * INTO inv FROM core.house_invitations WHERE house_id=h AND id=rid FOR UPDATE;
  IF inv.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
  IF inv.expires_at<=clock_timestamp() THEN PERFORM core.fail('not_found'); END IF;
  e:=inv.expires_at;d:=inv.retention_deadline_at;
 END IF;
 scope:=op||':'||coalesce(h::text,'me')||':'||coalesce(rid::text,'new');
 SELECT * INTO old FROM core.idempotency_records WHERE actor_user_id=uid AND route_scope=scope AND key_digest=k FOR UPDATE;
 IF old.id IS NOT NULL AND old.expires_at>clock_timestamp() THEN
  IF op='invite.accept' AND core.member(h) IS NULL THEN PERFORM core.fail('invite_unavailable'); END IF;
  IF old.request_hash<>bh THEN PERFORM core.fail('idempotency_conflict'); END IF;
  IF op='invite.create' AND (old.replay_until IS NULL OR old.replay_until<=clock_timestamp()) THEN PERFORM core.fail('idempotency_conflict'); END IF;
  RETURN jsonb_build_object('resourceId',old.resource_id,'resourceKind',old.resource_kind,'replayed',true,'replayCiphertext',CASE WHEN old.replay_until>clock_timestamp() THEN old.replay_ciphertext END);
 END IF;
 IF old.id IS NOT NULL THEN DELETE FROM core.idempotency_records WHERE id=old.id; END IF;
 result_id:=rid;

 CASE op
 WHEN 'house.create' THEN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p->>'timezone') THEN PERFORM core.fail('validation_error'); END IF;
  INSERT INTO core.houses(name,timezone,created_by_user_id) VALUES(p->>'name',p->>'timezone',uid) RETURNING id INTO result_id;
  INSERT INTO core.house_memberships(house_id,user_id,role) VALUES(result_id,uid,'owner');
  result_kind:='house';
 WHEN 'house.update' THEN
  IF role_name<>'owner' THEN PERFORM core.fail('forbidden'); END IF;
  PERFORM core.expect_version((SELECT version FROM core.houses WHERE id=h),(p->>'expectedVersion')::integer);
  UPDATE core.houses SET name=p->>'name',version=version+1 WHERE id=h;
  result_id:=h;result_kind:='house';
 WHEN 'invite.create' THEN
  IF p->>'tokenDigest' !~ '^[0-9a-f]{64}$' OR coalesce(length(p->>'replayCiphertext'),0)<32 THEN PERFORM core.fail('validation_error'); END IF;
  e:=n+interval '168 hours';d:=e+interval '24 hours';
  INSERT INTO core.house_invitations(house_id,creator_membership_id,token_digest,expires_at,retention_deadline_at) VALUES(h,m,p->>'tokenDigest',e,d) RETURNING id INTO result_id;
  replay_cipher:=p->>'replayCiphertext';replay_until:=n+interval '5 minutes';result_kind:='invitation';
 WHEN 'invite.revoke' THEN
  UPDATE core.house_invitations SET revoked_at=coalesce(revoked_at,n) WHERE house_id=h AND id=rid;
  result_kind:='invitation';
 WHEN 'invite.accept' THEN
  SELECT * INTO target FROM core.house_memberships WHERE house_id=h AND user_id=uid FOR UPDATE;
  IF target.state='active' THEN
   IF inv.consumed_at IS NOT NULL THEN PERFORM core.fail('invite_unavailable'); END IF;
   result_id:=target.id;
  ELSE
   IF inv.consumed_at IS NOT NULL THEN PERFORM core.fail('invite_unavailable'); END IF;
   IF target.id IS NULL THEN
    INSERT INTO core.house_memberships(house_id,user_id) VALUES(h,uid) RETURNING id INTO result_id;
   ELSE
    UPDATE core.house_memberships SET state='active',role='member',left_at=NULL,archived_expires_at=NULL,version=version+1 WHERE house_id=h AND id=target.id RETURNING id INTO result_id;
   END IF;
   UPDATE core.house_invitations SET consumed_at=n,consumed_by_user_id=uid WHERE house_id=h AND id=inv.id;
  END IF;
  result_kind:='membership';
 WHEN 'member.leave','member.remove','member.role' THEN
  PERFORM core.expect_version(target.version,(p->>'expectedVersion')::integer);
  IF target.state<>'active' THEN PERFORM core.fail('not_found'); END IF;
  IF target.role='owner' AND (op<>'member.role' OR p->>'role'<>'owner') AND (SELECT count(*) FROM core.house_memberships WHERE house_id=h AND state='active' AND role='owner')<=1 THEN PERFORM core.fail('forbidden'); END IF;
  IF op='member.role' THEN
   UPDATE core.house_memberships SET role=p->>'role',version=version+1 WHERE house_id=h AND id=rid;
  ELSE
   IF EXISTS(SELECT 1 FROM core.bills WHERE house_id=h AND status IN ('draft','open') AND expires_at>clock_timestamp() AND (creator_membership_id=rid OR recipient_membership_id=rid)) THEN PERFORM core.fail('forbidden'); END IF;
   UPDATE core.house_memberships SET state=CASE WHEN op='member.leave' THEN 'left' ELSE 'removed' END,left_at=n,archived_expires_at=n+interval '8760 hours',version=version+1 WHERE house_id=h AND id=rid;
   SELECT (n AT TIME ZONE timezone)::date INTO local_today FROM core.houses WHERE id=h;
   UPDATE core.chore_occurrences SET assignee_membership_id=NULL,assignee_name=NULL,version=version+1 WHERE house_id=h AND assignee_membership_id=rid AND status='pending' AND local_date>=local_today AND expires_at>clock_timestamp();
  END IF;
  result_kind:='membership';
 WHEN 'account.create' THEN
  IF (p->>'isDefault')::boolean THEN UPDATE core.recipient_accounts SET is_default=false,version=version+1 WHERE owner_user_id=uid AND is_default AND state='active'; END IF;
  INSERT INTO core.recipient_accounts(owner_user_id,bank_code,identifier_kind,identifier_ciphertext,identifier_digest,key_version,label,masked_account,is_default)
  VALUES(uid,p->>'bankCode',p->>'identifierKind',p->>'identifierCiphertext',p->>'identifierDigest',(p->>'keyVersion')::integer,p->>'label',p->>'maskedAccount',coalesce((p->>'isDefault')::boolean,false)) RETURNING id INTO result_id;
  result_kind:='account';
 WHEN 'account.update','account.archive' THEN
  PERFORM core.expect_version(a.version,(p->>'expectedVersion')::integer);
  IF a.state<>'active' THEN PERFORM core.fail('not_found'); END IF;
  IF op='account.archive' THEN
   UPDATE core.recipient_accounts SET state='archived',archived_at=n,archived_expires_at=n+interval '8760 hours',is_default=false,version=version+1 WHERE id=rid;
  ELSE
   IF (p->>'isDefault')::boolean THEN UPDATE core.recipient_accounts SET is_default=false,version=version+1 WHERE owner_user_id=uid AND is_default AND id<>rid AND state='active'; END IF;
   UPDATE core.recipient_accounts SET bank_code=coalesce(p->>'bankCode',bank_code),identifier_kind=coalesce(p->>'identifierKind',identifier_kind),identifier_ciphertext=coalesce(p->>'identifierCiphertext',identifier_ciphertext),identifier_digest=coalesce(p->>'identifierDigest',identifier_digest),key_version=coalesce((p->>'keyVersion')::integer,key_version),label=coalesce(p->>'label',label),masked_account=coalesce(p->>'maskedAccount',masked_account),is_default=coalesce((p->>'isDefault')::boolean,is_default),version=version+1 WHERE id=rid;
  END IF;
  result_kind:='account';
 WHEN 'bill.create','bill.update' THEN
  IF op='bill.update' THEN PERFORM core.expect_version(b.version,(p->>'expectedVersion')::integer); IF b.status<>'draft' THEN PERFORM core.fail('forbidden'); END IF; END IF;
  SELECT * INTO recipient FROM core.house_memberships WHERE house_id=h AND id=(p->>'recipientMembershipId')::uuid AND state='active';
  IF recipient.id IS NULL OR p->>'currency'<>'THB' OR jsonb_typeof(p->'participants')<>'array' THEN PERFORM core.fail('validation_error'); END IF;
  SELECT sum((value->>'basisPoints')::integer),count(*)-count(DISTINCT value->>'membershipId') INTO total_bps,remainder_count FROM jsonb_array_elements(p->'participants');
  IF total_bps IS DISTINCT FROM 10000 OR remainder_count<>0 THEN PERFORM core.fail('validation_error'); END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p->'participants') LOOP
   IF NOT EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=h AND id=(item->>'membershipId')::uuid AND state='active') OR (item->>'basisPoints')::integer NOT BETWEEN 1 AND 10000 THEN PERFORM core.fail('validation_error'); END IF;
  END LOOP;
  IF op='bill.create' THEN
   e:=n+interval '8736 hours';d:=n+interval '8760 hours';
   INSERT INTO core.bills(house_id,creator_membership_id,recipient_membership_id,recipient_user_id,title,emoji,total_satang,currency,due_date,expires_at,retention_deadline_at)
   VALUES(h,m,recipient.id,recipient.user_id,p->>'title',p->>'emoji',(p->>'totalSatang')::bigint,'THB',(p->>'dueDate')::date,e,d) RETURNING id INTO result_id;
  ELSE
   DELETE FROM core.bill_shares WHERE house_id=h AND bill_id=rid;
   UPDATE core.bills SET recipient_membership_id=recipient.id,recipient_user_id=recipient.user_id,title=p->>'title',emoji=p->>'emoji',total_satang=(p->>'totalSatang')::bigint,due_date=(p->>'dueDate')::date,version=version+1 WHERE house_id=h AND id=rid;
  END IF;
  INSERT INTO core.bill_shares(house_id,bill_id,membership_id,basis_points,member_name,expires_at,retention_deadline_at)
   SELECT h,result_id,x.id,(j.value->>'basisPoints')::integer,u.display_name,e,d FROM jsonb_array_elements(p->'participants') j JOIN core.house_memberships x ON x.house_id=h AND x.id=(j.value->>'membershipId')::uuid JOIN core.users u ON u.id=x.user_id;
  result_kind:='bill';
 WHEN 'bill.publish' THEN
  PERFORM core.expect_version(b.version,(p->>'expectedVersion')::integer);
  IF b.status<>'draft' THEN PERFORM core.fail('forbidden'); END IF;
  IF EXISTS(SELECT 1 FROM core.bill_shares s JOIN core.house_memberships x ON x.house_id=s.house_id AND x.id=s.membership_id WHERE s.house_id=h AND s.bill_id=rid AND x.state<>'active') OR NOT EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=h AND id=b.recipient_membership_id AND state='active') THEN PERFORM core.fail('validation_error'); END IF;
  SELECT * INTO a FROM core.recipient_accounts WHERE id=(p->>'recipientAccountId')::uuid AND owner_user_id=b.recipient_user_id FOR UPDATE;
  PERFORM core.require_live(e);
  IF core.member(h) IS DISTINCT FROM m THEN PERFORM core.fail('not_found'); END IF;
  IF a.id IS NULL OR a.state<>'active' OR a.version IS DISTINCT FROM (p->>'recipientAccountVersion')::integer THEN PERFORM core.fail('recipient_account_unavailable'); END IF;
  IF (SELECT sum(basis_points) FROM core.bill_shares WHERE house_id=h AND bill_id=rid) IS DISTINCT FROM 10000 THEN PERFORM core.fail('validation_error'); END IF;
  PERFORM 1 FROM core.bill_shares WHERE house_id=h AND bill_id=rid ORDER BY membership_id FOR UPDATE;
  WITH allocation AS (
   SELECT membership_id,floor(b.total_satang::numeric*basis_points/10000)::bigint AS base,
    row_number() OVER(ORDER BY mod(b.total_satang::numeric*basis_points,10000) DESC,membership_id) AS rank,
    b.total_satang-sum(floor(b.total_satang::numeric*basis_points/10000)) OVER() AS extra
   FROM core.bill_shares WHERE house_id=h AND bill_id=rid
  ) UPDATE core.bill_shares s SET amount_satang=x.base+CASE WHEN x.rank<=x.extra THEN 1 ELSE 0 END,self_covered=(s.membership_id=b.recipient_membership_id) FROM allocation x WHERE s.house_id=h AND s.bill_id=rid AND s.membership_id=x.membership_id;
  INSERT INTO core.bill_recipient_snapshots(house_id,bill_id,recipient_membership_id,recipient_user_id,source_account_id,account_version,bank_code,identifier_kind,identifier_ciphertext,identifier_digest,key_version,masked_account,recipient_name,expires_at,retention_deadline_at)
   SELECT h,rid,b.recipient_membership_id,b.recipient_user_id,a.id,a.version,a.bank_code,a.identifier_kind,a.identifier_ciphertext,a.identifier_digest,a.key_version,a.masked_account,u.display_name,e,d FROM core.users u WHERE u.id=b.recipient_user_id;
  UPDATE core.bills SET status=CASE WHEN EXISTS(SELECT 1 FROM core.bill_shares WHERE house_id=h AND bill_id=rid AND NOT self_covered AND amount_satang>0) THEN 'open' ELSE 'settled' END,published_at=n,version=version+1 WHERE house_id=h AND id=rid;
  PERFORM core.emit(h,m,'bill_published',rid);result_kind:='bill';
 WHEN 'bill.void' THEN
  PERFORM core.expect_version(b.version,(p->>'expectedVersion')::integer);
  IF b.status='voided' OR EXISTS(SELECT 1 FROM core.payment_confirmations WHERE house_id=h AND bill_id=rid) THEN PERFORM core.fail('forbidden'); END IF;
  UPDATE core.payment_attempts SET status='cancelled',reservation_released_at=n,version=version+1 WHERE house_id=h AND bill_id=rid AND status NOT IN ('confirmed','rejected','cancelled');
  UPDATE core.bills SET status='voided',voided_at=n,version=version+1 WHERE house_id=h AND id=rid;
  PERFORM core.emit(h,m,'bill_voided',rid);result_kind:='bill';
 WHEN 'payment.reserve' THEN
  PERFORM core.expect_version(b.version,(p->>'expectedVersion')::integer);
  IF b.status<>'open' OR p->>'method' NOT IN ('cash','transfer') THEN PERFORM core.fail('forbidden'); END IF;
  amount:=(p->>'amountSatang')::bigint;
  SELECT coalesce(sum(amount_satang),0) INTO credited FROM core.payment_confirmations WHERE house_id=h AND bill_id=rid AND payer_membership_id=m;
  SELECT coalesce(sum(amount_satang),0) INTO reserved FROM core.payment_attempts WHERE house_id=h AND bill_id=rid AND payer_membership_id=m AND reservation_released_at IS NULL AND reservation_until>clock_timestamp();
  IF amount IS NULL OR amount<1 OR amount>900000000000 THEN PERFORM core.fail('validation_error'); END IF;
  IF amount>sh.amount_satang-credited-reserved THEN PERFORM core.fail('insufficient_share'); END IF;
  INSERT INTO core.payment_attempts(house_id,bill_id,payer_membership_id,method,amount_satang,status,reservation_until,expires_at,retention_deadline_at)
   VALUES(h,rid,m,p->>'method',amount,CASE WHEN p->>'method'='cash' THEN 'awaiting_confirmation' ELSE 'awaiting_upload' END,least(e,clock_timestamp()+CASE WHEN p->>'method'='cash' THEN interval '24 hours' ELSE interval '30 minutes' END),e,d) RETURNING id INTO result_id;
  PERFORM core.emit(h,m,'payment_pending',rid);result_kind:='payment';
 WHEN 'cash.confirm','cash.reject','payment.cancel' THEN
  PERFORM core.expect_version(pay.version,(p->>'expectedVersion')::integer);
  IF pay.status IN ('confirmed','rejected','cancelled') OR b.status<>'open' THEN PERFORM core.fail('forbidden'); END IF;
  IF op='cash.confirm' THEN
   SELECT coalesce(sum(amount_satang),0) INTO credited FROM core.payment_confirmations WHERE house_id=h AND bill_id=b.id AND payer_membership_id=pay.payer_membership_id;
   SELECT coalesce(sum(amount_satang),0) INTO reserved FROM core.payment_attempts WHERE house_id=h AND bill_id=b.id AND payer_membership_id=pay.payer_membership_id AND id<>pay.id AND reservation_released_at IS NULL AND reservation_until>clock_timestamp();
   IF sh.self_covered OR pay.amount_satang>sh.amount_satang-credited-reserved THEN PERFORM core.fail('insufficient_share'); END IF;
   PERFORM core.require_live(e);
   INSERT INTO core.payment_confirmations(house_id,bill_id,attempt_id,payer_membership_id,actor_membership_id,amount_satang,self_confirmed,expires_at,retention_deadline_at)
    VALUES(h,b.id,pay.id,pay.payer_membership_id,m,pay.amount_satang,pay.payer_membership_id=m,e,d) RETURNING id INTO credit_id;
   UPDATE core.payment_attempts SET status='confirmed',reservation_released_at=n,decision_by_membership_id=m,decided_at=n,version=version+1 WHERE house_id=h AND id=rid;
   IF NOT EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=b.id AND NOT s.self_covered AND s.amount_satang>(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=b.id AND c.payer_membership_id=s.membership_id)) THEN UPDATE core.bills SET status='settled',version=version+1 WHERE house_id=h AND id=b.id; END IF;
   PERFORM core.emit(h,m,CASE WHEN pay.payer_membership_id=m THEN 'cash_self_confirmed' ELSE 'cash_confirmed' END,b.id,NULL,credit_id);
  ELSE
   IF op='cash.reject' AND coalesce(length(p->>'reason'),0) NOT BETWEEN 1 AND 500 THEN PERFORM core.fail('validation_error'); END IF;
   UPDATE core.payment_attempts SET status=CASE WHEN op='cash.reject' THEN 'rejected' ELSE 'cancelled' END,reservation_released_at=n,decision_by_membership_id=CASE WHEN op='cash.reject' THEN m END,decided_at=CASE WHEN op='cash.reject' THEN n END,rejection_reason=CASE WHEN op='cash.reject' THEN p->>'reason' END,version=version+1 WHERE house_id=h AND id=rid;
   PERFORM core.emit(h,m,CASE WHEN op='cash.reject' THEN 'cash_rejected' ELSE 'payment_cancelled' END,b.id);
  END IF;
  result_kind:='payment';
 WHEN 'chore.create' THEN
  SELECT * INTO target FROM core.house_memberships WHERE house_id=h AND id=(p->>'assigneeMembershipId')::uuid AND state='active';
  IF target.id IS NULL THEN PERFORM core.fail('validation_error'); END IF;
  e:=n+interval '8736 hours';d:=n+interval '8760 hours';
  INSERT INTO core.chore_occurrences(house_id,local_date,timezone,title,emoji,creator_membership_id,assignee_membership_id,assignee_name,expires_at,retention_deadline_at)
   SELECT h,(p->>'localDate')::date,x.timezone,p->>'title',p->>'emoji',m,target.id,u.display_name,e,d FROM core.houses x,core.users u WHERE x.id=h AND u.id=target.user_id RETURNING id INTO result_id;
  PERFORM core.emit(h,m,'chore_created',NULL,result_id);result_kind:='chore';
 WHEN 'chore.complete','chore.reopen','chore.cancel','chore.update' THEN
  PERFORM core.expect_version(occ.version,(p->>'expectedVersion')::integer);
  IF (op='chore.complete' AND occ.status<>'pending') OR (op='chore.reopen' AND occ.status<>'completed') OR (op IN ('chore.cancel','chore.update') AND occ.status<>'pending') THEN PERFORM core.fail('forbidden'); END IF;
  IF op='chore.update' THEN
   SELECT (n AT TIME ZONE timezone)::date INTO local_today FROM core.houses WHERE id=h;
   IF occ.local_date<local_today THEN PERFORM core.fail('forbidden'); END IF;
   SELECT * INTO target FROM core.house_memberships WHERE house_id=h AND id=(p->>'assigneeMembershipId')::uuid AND state='active';
   IF target.id IS NULL THEN PERFORM core.fail('validation_error'); END IF;
   UPDATE core.chore_occurrences SET title=coalesce(p->>'title',title),assignee_membership_id=target.id,assignee_name=(SELECT display_name FROM core.users WHERE id=target.user_id),version=version+1 WHERE house_id=h AND id=rid;
  ELSE
   UPDATE core.chore_occurrences SET status=CASE op WHEN 'chore.complete' THEN 'completed' WHEN 'chore.reopen' THEN 'pending' ELSE 'cancelled' END,completed_at=CASE WHEN op='chore.complete' THEN n END,version=version+1 WHERE house_id=h AND id=rid;
   IF op IN ('chore.complete','chore.reopen') THEN INSERT INTO core.chore_completion_events(house_id,occurrence_id,actor_membership_id,transition_version,action,expires_at,retention_deadline_at) VALUES(h,rid,m,occ.version+1,CASE WHEN op='chore.complete' THEN 'completed' ELSE 'reopened' END,e,d); END IF;
  END IF;
  PERFORM core.emit(h,m,replace(op,'.','_'),NULL,rid);result_kind:='chore';
 WHEN 'schedule.create','schedule.update' THEN
  rule:=p->'rule';
  IF op='schedule.update' THEN
   PERFORM core.expect_version(sched.version,(p->>'expectedVersion')::integer);
   SELECT (n AT TIME ZONE timezone)::date INTO local_today FROM core.houses WHERE id=h;
   IF p->>'effectiveFrom' IS NULL OR (p->>'effectiveFrom')::date<=local_today OR (rule->>'startDate')::date<>(p->>'effectiveFrom')::date THEN PERFORM core.fail('validation_error'); END IF;
   UPDATE core.chore_revisions SET superseded_at=n,archive_expires_at=n+interval '8760 hours' WHERE house_id=h AND schedule_id=rid AND revision=sched.active_revision;
   UPDATE core.chore_schedules SET active_revision=active_revision+1,version=version+1 WHERE house_id=h AND id=rid RETURNING * INTO sched;
   -- Completed and past occurrences stay frozen; only future pending rows are regenerated.
   UPDATE core.chore_occurrences o SET status='cancelled',version=version+1 WHERE o.house_id=h AND o.schedule_id=rid AND o.local_date>=(p->>'effectiveFrom')::date AND o.status='pending' AND NOT EXISTS(SELECT 1 FROM core.chore_completion_events ce WHERE ce.house_id=h AND ce.occurrence_id=o.id);
  ELSE
   INSERT INTO core.chore_schedules(house_id,creator_membership_id) VALUES(h,m) RETURNING * INTO sched;result_id:=sched.id;
  END IF;
  IF rule->>'timezone' IS DISTINCT FROM (SELECT timezone FROM core.houses WHERE id=h) OR jsonb_typeof(rule->'assigneeMembershipIds')<>'array' OR jsonb_typeof(rule->'weekdays')<>'array' THEN PERFORM core.fail('validation_error'); END IF;
  pool_size:=jsonb_array_length(rule->'assigneeMembershipIds');
  IF pool_size<1 OR (rule->>'mode'='repeat' AND pool_size<>1) OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(rule->'assigneeMembershipIds'))<>pool_size THEN PERFORM core.fail('validation_error'); END IF;
  IF (SELECT coalesce(array_agg(value::integer),'{}'::integer[]) FROM jsonb_array_elements_text(rule->'weekdays')) IS DISTINCT FROM (SELECT coalesce(array_agg(DISTINCT value::integer ORDER BY value::integer),'{}'::integer[]) FROM jsonb_array_elements_text(rule->'weekdays')) THEN PERFORM core.fail('validation_error'); END IF;
  INSERT INTO core.chore_revisions(house_id,schedule_id,revision,title,emoji,mode,timezone,anchor_date,start_date,end_date,frequency,weekdays)
   VALUES(h,sched.id,sched.active_revision,p->>'title',p->>'emoji',rule->>'mode',rule->>'timezone',(rule->>'anchorDate')::date,(rule->>'startDate')::date,(rule->>'endDate')::date,rule->>'interval',ARRAY(SELECT value::integer FROM jsonb_array_elements_text(rule->'weekdays')));
  FOR item,ordinal IN SELECT value,ordinality-1 FROM jsonb_array_elements(rule->'assigneeMembershipIds') WITH ORDINALITY LOOP
   mid:=(item#>>'{}')::uuid;
   IF NOT EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=h AND id=mid AND state='active') THEN PERFORM core.fail('validation_error'); END IF;
   INSERT INTO core.chore_rotation_members(house_id,schedule_id,revision,position,membership_id) VALUES(h,sched.id,sched.active_revision,ordinal::integer,mid);
  END LOOP;
  result_kind:='schedule';
 WHEN 'schedule.archive' THEN
  PERFORM core.expect_version(sched.version,(p->>'expectedVersion')::integer);
  UPDATE core.chore_schedules SET state='archived',version=version+1 WHERE house_id=h AND id=rid;result_kind:='schedule';
 WHEN 'schedule.generate' THEN
  PERFORM core.expect_version(sched.version,(p->>'expectedVersion')::integer);
  IF sched.state<>'active' THEN PERFORM core.fail('forbidden'); END IF;
  days:=(p->>'days')::integer;
  IF days IS NULL OR days NOT BETWEEN 1 AND 30 THEN PERFORM core.fail('validation_error'); END IF;
  day_start:=(p->>'startDate')::date;
  SELECT (n AT TIME ZONE timezone)::date INTO local_today FROM core.houses WHERE id=h;
  IF day_start IS NULL OR day_start<local_today THEN PERFORM core.fail('validation_error'); END IF;
  FOR gen_date IN SELECT day_start+i FROM generate_series(0,days-1) i LOOP
   SELECT * INTO rev FROM core.chore_revisions WHERE house_id=h AND schedule_id=rid AND start_date<=gen_date ORDER BY revision DESC LIMIT 1;
   IF rev.schedule_id IS NULL OR (rev.end_date IS NOT NULL AND gen_date>rev.end_date) OR (rev.frequency='weekly' AND NOT extract(dow FROM gen_date)::integer=ANY(rev.weekdays)) THEN CONTINUE; END IF;
   SELECT count(*) INTO pool_size FROM core.chore_rotation_members WHERE house_id=h AND schedule_id=rid AND revision=rev.revision;
   -- Count scheduled dates from stable anchor in O(1), avoiding unbounded generate_series from old anchors.
   IF rev.frequency='daily' THEN ordinal:=gen_date-rev.anchor_date;
   ELSE SELECT sum(((gen_date-rev.anchor_date)/7)::bigint+CASE WHEN ((w-extract(dow FROM rev.anchor_date)::integer+7)%7)<=(gen_date-rev.anchor_date)%7 THEN 1 ELSE 0 END)-1 INTO ordinal FROM unnest(rev.weekdays) w; END IF;
   SELECT x.id INTO selected FROM core.chore_rotation_members pool JOIN core.house_memberships x ON x.house_id=pool.house_id AND x.id=pool.membership_id AND x.state='active'
    WHERE pool.house_id=h AND pool.schedule_id=rid AND pool.revision=rev.revision AND pool.position=CASE WHEN rev.mode='repeat' THEN 0 ELSE (ordinal%pool_size)::integer END;
   e:=n+interval '8736 hours';d:=n+interval '8760 hours';
   INSERT INTO core.chore_occurrences(house_id,schedule_id,schedule_revision,local_date,timezone,title,emoji,creator_membership_id,assignee_membership_id,assignee_name,rotation_ordinal,expires_at,retention_deadline_at)
    VALUES(h,rid,rev.revision,gen_date,rev.timezone,rev.title,rev.emoji,sched.creator_membership_id,selected,(SELECT u.display_name FROM core.users u JOIN core.house_memberships x ON x.user_id=u.id WHERE x.house_id=h AND x.id=selected),ordinal,e,d) ON CONFLICT(house_id,schedule_id,local_date) DO UPDATE SET schedule_revision=excluded.schedule_revision,title=excluded.title,emoji=excluded.emoji,assignee_membership_id=excluded.assignee_membership_id,assignee_name=excluded.assignee_name,rotation_ordinal=excluded.rotation_ordinal,status='pending',version=core.chore_occurrences.version+1 WHERE core.chore_occurrences.schedule_revision<excluded.schedule_revision AND core.chore_occurrences.status='cancelled' AND NOT EXISTS(SELECT 1 FROM core.chore_completion_events ce WHERE ce.house_id=h AND ce.occurrence_id=core.chore_occurrences.id);
  END LOOP;
  result_kind:='schedule';
 WHEN 'activity.read' THEN
  SELECT * INTO old FROM core.idempotency_records WHERE false;
  SELECT created_at,id INTO n,result_id FROM core.activity_events ae WHERE ae.house_id=h AND ae.id=(p->>'eventId')::uuid AND ae.expires_at>clock_timestamp() AND (ae.bill_id IS NULL OR EXISTS(SELECT 1 FROM core.bills parent_bill WHERE parent_bill.house_id=h AND parent_bill.id=ae.bill_id AND parent_bill.expires_at>clock_timestamp())) AND (ae.occurrence_id IS NULL OR EXISTS(SELECT 1 FROM core.chore_occurrences o WHERE o.house_id=h AND o.id=ae.occurrence_id AND o.expires_at>clock_timestamp()));
  IF result_id IS NULL THEN PERFORM core.fail('not_found'); END IF;
  INSERT INTO core.activity_read_state(house_id,membership_id,last_seen_at,last_seen_id) VALUES(h,m,n,result_id)
  ON CONFLICT(house_id,membership_id) DO UPDATE SET last_seen_at=excluded.last_seen_at,last_seen_id=excluded.last_seen_id,updated_at=statement_timestamp() WHERE (core.activity_read_state.last_seen_at,core.activity_read_state.last_seen_id)<(excluded.last_seen_at,excluded.last_seen_id);
  result_kind:='activity';
 WHEN 'session.revoke' THEN
  PERFORM 1 FROM core.sessions WHERE family_id=(SELECT family_id FROM core.sessions WHERE id=nullif(current_setting('ourhoomu.session_id',true),'')::uuid) ORDER BY generation,id LIMIT 1 FOR UPDATE;
  UPDATE core.sessions SET revoked_at=coalesce(revoked_at,n),replay_ciphertext=NULL,replay_until=NULL WHERE family_id=(SELECT family_id FROM core.sessions WHERE id=nullif(current_setting('ourhoomu.session_id',true),'')::uuid) AND user_id=uid;
  result_id:=nullif(current_setting('ourhoomu.session_id',true),'')::uuid;result_kind:='session';
 ELSE PERFORM core.fail('feature_unavailable');
 END CASE;
 INSERT INTO core.idempotency_records(actor_user_id,house_id,route_scope,key_digest,request_hash,resource_kind,resource_id,replay_ciphertext,replay_until,expires_at,retention_deadline_at)
 VALUES(uid,h,scope,k,bh,result_kind,result_id,replay_cipher,replay_until,least(e,statement_timestamp()+interval '8736 hours'),least(d,statement_timestamp()+interval '8760 hours'));
 RETURN jsonb_build_object('resourceId',result_id,'resourceKind',result_kind,'replayed',false,'replayCiphertext',replay_cipher);
END $$;

-- Only the separately credentialed trusted verifier can call these primitives.
-- Its caller must verify issuer signature/audience/nonce before exchange; this is not an IdP verifier.
CREATE FUNCTION core.auth_command(op text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ch core.auth_challenges; ident core.auth_identities; s core.sessions; next_session core.sessions; uid uuid; n timestamptz:=statement_timestamp();
BEGIN
 CASE op
 WHEN 'challenge' THEN
  INSERT INTO core.auth_challenges(provider,proof_digest,expires_at) VALUES(p->>'provider',p->>'proofDigest',n+interval '5 minutes') RETURNING * INTO ch;
  RETURN jsonb_build_object('challengeId',ch.id,'expiresAt',ch.expires_at);
 WHEN 'exchange' THEN
  SELECT * INTO ch FROM core.auth_challenges WHERE id=(p->>'challengeId')::uuid FOR UPDATE;
  IF ch.id IS NULL OR ch.consumed_at IS NOT NULL OR ch.expires_at<=clock_timestamp() OR ch.proof_digest IS DISTINCT FROM p->>'proofDigest' OR ch.provider IS DISTINCT FROM p->>'provider' THEN PERFORM core.fail('unauthenticated'); END IF;
  -- Global issuer+subject uniqueness, with ON CONFLICT resolving simultaneous first login.
  SELECT * INTO ident FROM core.auth_identities WHERE issuer=p->>'issuer' AND subject=p->>'subject';
  IF ident.id IS NULL THEN
   INSERT INTO core.users(display_name) VALUES(p->>'displayName') RETURNING id INTO uid;
   INSERT INTO core.auth_identities(user_id,issuer,subject,provider) VALUES(uid,p->>'issuer',p->>'subject',p->>'provider') ON CONFLICT(issuer,subject) DO NOTHING RETURNING * INTO ident;
   IF ident.id IS NULL THEN DELETE FROM core.users WHERE id=uid; SELECT * INTO ident FROM core.auth_identities WHERE issuer=p->>'issuer' AND subject=p->>'subject'; END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM core.users WHERE id=ident.user_id AND state='active') THEN PERFORM core.fail('unauthenticated'); END IF;
  UPDATE core.auth_challenges SET consumed_at=n WHERE id=ch.id;
  INSERT INTO core.sessions(user_id,identity_id,access_digest,refresh_digest,family_id,auth_time,expires_at,refresh_expires_at)
   VALUES(ident.user_id,ident.id,p->>'accessDigest',p->>'refreshDigest',gen_random_uuid(),(p->>'authTime')::timestamptz,(p->>'expiresAt')::timestamptz,(p->>'refreshExpiresAt')::timestamptz) RETURNING * INTO s;
  RETURN jsonb_build_object('userId',s.user_id,'sessionId',s.id,'issuer',ident.issuer,'subject',ident.subject,'authTime',s.auth_time,'expiresAt',s.expires_at);
 WHEN 'verify' THEN
  SELECT * INTO s FROM core.sessions WHERE access_digest=p->>'accessDigest';
  IF s.id IS NULL OR s.revoked_at IS NOT NULL OR s.rotated_at IS NOT NULL OR s.expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM core.sessions WHERE family_id=s.family_id AND revoked_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM core.users WHERE id=s.user_id AND state='active') THEN PERFORM core.fail('unauthenticated'); END IF;
  SELECT * INTO ident FROM core.auth_identities WHERE id=s.identity_id;
  RETURN jsonb_build_object('userId',s.user_id,'sessionId',s.id,'issuer',ident.issuer,'subject',ident.subject,'authTime',s.auth_time,'expiresAt',s.expires_at);
 WHEN 'rotate' THEN
  SELECT * INTO s FROM core.sessions WHERE refresh_digest=p->>'refreshDigest';
  IF s.id IS NULL THEN RETURN jsonb_build_object('error','unauthenticated'); END IF;
  -- Lock immutable family root first, then credential rows, avoiding cross-generation deadlocks.
  PERFORM 1 FROM core.sessions WHERE family_id=s.family_id ORDER BY generation,id LIMIT 1 FOR UPDATE;
  SELECT * INTO s FROM core.sessions WHERE id=s.id FOR UPDATE;
  IF s.revoked_at IS NOT NULL OR s.refresh_expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM core.sessions WHERE family_id=s.family_id AND revoked_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM core.users WHERE id=s.user_id AND state='active') THEN RETURN jsonb_build_object('error','unauthenticated'); END IF;
  IF s.rotated_at IS NOT NULL THEN
   IF s.replay_until>clock_timestamp() AND s.replay_key_digest=p->>'keyDigest' AND s.replay_body_hash=p->>'bodyHash' THEN RETURN jsonb_build_object('replayed',true,'replayCiphertext',s.replay_ciphertext); END IF;
   UPDATE core.sessions SET revoked_at=coalesce(revoked_at,n),replay_ciphertext=NULL,replay_until=NULL WHERE family_id=s.family_id;
   -- Return failure instead of raising: revocation must commit before HTTP401.
   RETURN jsonb_build_object('error','unauthenticated');
  END IF;
  IF p->>'keyDigest' !~ '^[0-9a-f]{64}$' OR p->>'bodyHash' !~ '^[0-9a-f]{64}$' OR coalesce(length(p->>'replayCiphertext'),0)<32 THEN PERFORM core.fail('validation_error'); END IF;
  INSERT INTO core.sessions(user_id,identity_id,access_digest,refresh_digest,family_id,generation,auth_time,expires_at,refresh_expires_at)
   VALUES(s.user_id,s.identity_id,p->>'nextAccessDigest',p->>'nextRefreshDigest',s.family_id,s.generation+1,s.auth_time,least((p->>'expiresAt')::timestamptz,s.refresh_expires_at),s.refresh_expires_at) RETURNING * INTO next_session;
  UPDATE core.sessions SET rotated_at=n,replay_key_digest=p->>'keyDigest',replay_body_hash=p->>'bodyHash',replay_ciphertext=p->>'replayCiphertext',replay_until=least(n+interval '5 minutes',refresh_expires_at) WHERE id=s.id;
  RETURN jsonb_build_object('sessionId',next_session.id,'replayed',false,'replayCiphertext',p->>'replayCiphertext');
 WHEN 'revoke' THEN
  SELECT * INTO s FROM core.sessions WHERE id=(p->>'sessionId')::uuid;
  IF s.id IS NOT NULL THEN
   PERFORM 1 FROM core.sessions WHERE family_id=s.family_id ORDER BY generation,id LIMIT 1 FOR UPDATE;
   UPDATE core.sessions SET revoked_at=coalesce(revoked_at,n),replay_ciphertext=NULL,replay_until=NULL WHERE family_id=s.family_id;
  END IF;
  RETURN jsonb_build_object('revoked',true);
 ELSE PERFORM core.fail('feature_unavailable');
 END CASE;
END $$;

CREATE FUNCTION core.private_destination(h uuid,bid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid; b core.bills;
BEGIN
 m:=core.member(h); IF m IS NULL THEN PERFORM core.fail('not_found'); END IF;
 SELECT * INTO b FROM core.bills WHERE house_id=h AND id=bid;
 IF b.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
 PERFORM core.require_live(b.expires_at);
 IF b.recipient_membership_id<>m AND NOT EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.amount_satang>(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid AND c.payer_membership_id=m)) THEN PERFORM core.fail('forbidden'); END IF;
 RETURN (SELECT jsonb_build_object('bankCode',bank_code,'identifierKind',identifier_kind,'identifierCiphertext',identifier_ciphertext,'keyVersion',key_version,'recipientName',recipient_name) FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>clock_timestamp());
END $$;
CREATE FUNCTION core.account_selector(h uuid,bid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid; b core.bills;
BEGIN
 m:=core.member(h); IF m IS NULL THEN PERFORM core.fail('not_found'); END IF;
 SELECT * INTO b FROM core.bills WHERE house_id=h AND id=bid;
 IF b.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
 PERFORM core.require_live(b.expires_at);
 IF b.creator_membership_id<>m OR b.status<>'draft' THEN PERFORM core.fail('forbidden'); END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'version',a.version,'bankCode',a.bank_code,'label',a.label,'maskedAccount',a.masked_account,'isDefault',a.is_default)),'[]'::jsonb) FROM core.recipient_accounts a JOIN core.house_memberships x ON x.house_id=h AND x.id=b.recipient_membership_id AND x.user_id=a.owner_user_id AND x.state='active' WHERE a.state='active');
END $$;

CREATE FUNCTION core.reader(h uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid:=core.member(h); BEGIN IF m IS NULL THEN PERFORM core.fail('not_found'); END IF; RETURN m; END $$;
CREATE FUNCTION core.member_profiles(h uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM core.reader(h); RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'houseId',h,'displayName',u.display_name,'role',m.role,'active',m.state='active','version',m.version)),'[]'::jsonb) FROM core.house_memberships m JOIN core.users u ON u.id=m.user_id WHERE m.house_id=h AND m.state='active'); END $$;
CREATE FUNCTION core.bill_detail(h uuid,bid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid:=core.reader(h);b core.bills;masked jsonb;shares jsonb;private_account jsonb;
BEGIN
 SELECT * INTO b FROM core.bills WHERE house_id=h AND id=bid;
 IF b.id IS NULL THEN PERFORM core.fail('not_found'); END IF;PERFORM core.require_live(b.expires_at);
 SELECT jsonb_build_object('sourceAccountId',source_account_id,'accountVersion',account_version,'bankCode',bank_code,'identifierKind',identifier_kind,'maskedAccount',masked_account,'recipientName',recipient_name) INTO masked FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>clock_timestamp();
 SELECT coalesce(jsonb_agg(to_jsonb(s)-'retention_deadline_at'||jsonb_build_object('confirmed_satang',coalesce(c.amount,0)::text,'remaining_satang',CASE WHEN s.self_covered THEN '0' ELSE (s.amount_satang-coalesce(c.amount,0))::text END)),'[]'::jsonb) INTO shares FROM core.bill_shares s LEFT JOIN LATERAL(SELECT sum(amount_satang) amount FROM core.payment_confirmations WHERE house_id=h AND bill_id=bid AND payer_membership_id=s.membership_id AND expires_at>clock_timestamp()) c ON true WHERE s.house_id=h AND s.bill_id=bid AND s.expires_at>clock_timestamp();
 IF b.recipient_membership_id=m OR EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.amount_satang>(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid AND c.payer_membership_id=m)) THEN private_account:=core.private_destination(h,bid);END IF;
 RETURN (to_jsonb(b)-'recipient_user_id'-'retention_deadline_at')||jsonb_build_object('shares',shares,'recipientAccountMasked',masked,'recipientAccountEncrypted',private_account);
END $$;
CREATE FUNCTION core.resource(kind text,h uuid,rid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;expiry timestamptz;bid uuid;
BEGIN
 PERFORM core.reader(h);
 IF kind='chore' THEN SELECT to_jsonb(o)-'retention_deadline_at',o.expires_at INTO result,expiry FROM core.chore_occurrences o WHERE house_id=h AND id=rid;
 ELSIF kind='payment' THEN
  SELECT to_jsonb(p)-'retention_deadline_at',p.expires_at,p.bill_id INTO result,expiry,bid FROM core.payment_attempts p WHERE house_id=h AND id=rid;
  IF bid IS NOT NULL THEN PERFORM core.require_live((SELECT expires_at FROM core.bills WHERE house_id=h AND id=bid)); END IF;
 ELSE PERFORM core.fail('feature_unavailable');END IF;
 IF result IS NULL THEN PERFORM core.fail('not_found');END IF;PERFORM core.require_live(expiry);RETURN result;
END $$;
CREATE FUNCTION core.dashboard(h uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE m uuid:=core.reader(h);outstanding numeric;owed numeric;pending numeric;
BEGIN
 WITH remaining AS (
  SELECT s.membership_id,b.recipient_membership_id,s.amount_satang-(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=s.bill_id AND c.payer_membership_id=s.membership_id AND c.expires_at>clock_timestamp()) amount
  FROM core.bill_shares s JOIN core.bills b ON b.house_id=s.house_id AND b.id=s.bill_id WHERE s.house_id=h AND s.expires_at>clock_timestamp() AND b.expires_at>clock_timestamp() AND b.status IN ('open','settled') AND NOT s.self_covered
 ) SELECT coalesce(sum(amount) FILTER(WHERE membership_id=m),0),coalesce(sum(amount) FILTER(WHERE recipient_membership_id=m),0) INTO outstanding,owed FROM remaining;
 SELECT coalesce(sum(p.amount_satang),0) INTO pending FROM core.payment_attempts p JOIN core.bills b ON b.house_id=p.house_id AND b.id=p.bill_id WHERE p.house_id=h AND p.payer_membership_id=m AND p.reservation_released_at IS NULL AND p.reservation_until>statement_timestamp() AND p.expires_at>clock_timestamp() AND b.expires_at>clock_timestamp() AND b.status='open';
 RETURN jsonb_build_object('outstandingSatang',outstanding::text,'owedToMeSatang',owed::text,'pendingSatang',pending::text);
END $$;
CREATE FUNCTION core.preview_schedule(h uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE rule jsonb:=p; anchor date:=(p->>'anchorDate')::date; start_day date:=(p->>'startDate')::date; end_day date:=(p->>'endDate')::date;ws integer[];pool uuid[];day date;ordinal bigint;selected uuid;result jsonb:='[]'::jsonb;
BEGIN
 PERFORM core.reader(h);
 SELECT ARRAY(SELECT x::integer FROM jsonb_array_elements_text(rule->'weekdays') x),ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(rule->'assigneeMembershipIds') x) INTO ws,pool;
 IF anchor IS NULL OR start_day IS NULL OR anchor>start_day OR end_day<start_day OR rule->>'timezone' IS DISTINCT FROM (SELECT timezone FROM core.houses WHERE id=h) OR rule->>'mode' NOT IN ('repeat','rotation') OR rule->>'interval' NOT IN ('daily','weekly') OR cardinality(pool)<1 OR (rule->>'mode'='repeat' AND cardinality(pool)<>1) OR cardinality(pool)<>(SELECT count(DISTINCT x) FROM unnest(pool)x) OR NOT ws<@ARRAY[0,1,2,3,4,5,6] OR ws IS DISTINCT FROM (SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}'::integer[]) FROM unnest(ws)x) OR (rule->>'interval'='daily' AND cardinality(ws)<>0) OR (rule->>'interval'='weekly' AND cardinality(ws)=0) THEN PERFORM core.fail('validation_error'); END IF;
 IF EXISTS(SELECT 1 FROM unnest(pool)x WHERE NOT EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=h AND id=x AND state='active')) THEN PERFORM core.fail('validation_error'); END IF;
 FOR day IN SELECT start_day+i FROM generate_series(0,13)i WHERE end_day IS NULL OR start_day+i<=end_day LOOP
  IF rule->>'interval'='weekly' AND NOT extract(dow FROM day)::integer=ANY(ws) THEN CONTINUE;END IF;
  IF rule->>'interval'='daily' THEN ordinal:=day-anchor;ELSE SELECT sum(((day-anchor)/7)::bigint+CASE WHEN ((w-extract(dow FROM anchor)::integer+7)%7)<=(day-anchor)%7 THEN 1 ELSE 0 END)-1 INTO ordinal FROM unnest(ws)w;END IF;
  selected:=pool[CASE WHEN rule->>'mode'='repeat' THEN 1 ELSE (ordinal%cardinality(pool))::integer+1 END];
  result:=result||jsonb_build_array(jsonb_build_object('localDate',day,'assigneeMembershipId',selected));
 END LOOP;
 RETURN jsonb_build_object('timezone',rule->>'timezone','occurrences',result);
END $$;

-- Internal credential hygiene; scheduling/physical deletion evidence remains SW-0037.
CREATE FUNCTION core.clear_replay_secrets() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE family uuid;
BEGIN
 FOR family IN SELECT DISTINCT family_id FROM core.sessions WHERE replay_until<=clock_timestamp() ORDER BY family_id LOOP
  PERFORM 1 FROM core.sessions WHERE family_id=family ORDER BY generation,id LIMIT 1 FOR UPDATE;
  UPDATE core.sessions SET replay_ciphertext=NULL,replay_until=NULL WHERE family_id=family AND replay_until<=clock_timestamp();
 END LOOP;
 UPDATE core.idempotency_records SET replay_ciphertext=NULL,replay_until=NULL WHERE replay_until<=clock_timestamp();
END $$;

-- Opaque /payments/{id} routes resolve only internal parent scope, then reauthorize under command locks.
CREATE FUNCTION core.resolve_payment_house(attempt_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h uuid;
BEGIN
 IF core.actor() IS NULL THEN PERFORM core.fail('unauthenticated'); END IF;
 SELECT house_id INTO h FROM core.payment_attempts WHERE id=attempt_id;
 IF h IS NULL THEN PERFORM core.fail('not_found'); END IF;
 PERFORM core.reader(h); RETURN h;
END $$;

-- Defaults deny every table. Only routine owner has write policies. No client role can SET ROLE to it.
DO $$ DECLARE tab text; BEGIN
 FOR tab IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='core' LOOP
  EXECUTE format('ALTER TABLE core.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE core.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY routine_owner ON core.%I TO ourhoomu_core_writer USING (true) WITH CHECK (true)',tab);
 END LOOP;
END $$;
CREATE POLICY own_user ON core.users FOR SELECT TO ourhoomu_core_app USING(id=core.actor());
CREATE POLICY member_house ON core.houses FOR SELECT TO ourhoomu_core_app USING(core.member(id) IS NOT NULL);
CREATE POLICY member_rows ON core.house_memberships FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND (state='active' OR archived_expires_at>clock_timestamp()));
CREATE POLICY own_account ON core.recipient_accounts FOR SELECT TO ourhoomu_core_app USING(owner_user_id=core.actor() AND (state='active' OR archived_expires_at>clock_timestamp()));
CREATE POLICY owner_invite ON core.house_invitations FOR SELECT TO ourhoomu_core_app USING(expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=house_invitations.house_id AND id=core.member(house_invitations.house_id) AND role='owner'));
CREATE POLICY visible_bill ON core.bills FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp());
CREATE POLICY visible_share ON core.bill_shares FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM core.bills WHERE house_id=bill_shares.house_id AND id=bill_shares.bill_id));
CREATE POLICY visible_snapshot ON core.bill_recipient_snapshots FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM core.bills WHERE house_id=bill_recipient_snapshots.house_id AND id=bill_recipient_snapshots.bill_id));
CREATE POLICY visible_attempt ON core.payment_attempts FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM core.bills WHERE house_id=payment_attempts.house_id AND id=payment_attempts.bill_id));
CREATE POLICY visible_credit ON core.payment_confirmations FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM core.bills WHERE house_id=payment_confirmations.house_id AND id=payment_confirmations.bill_id));
CREATE POLICY visible_occurrence ON core.chore_occurrences FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp());
CREATE POLICY visible_completion ON core.chore_completion_events FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM core.chore_occurrences WHERE house_id=chore_completion_events.house_id AND id=chore_completion_events.occurrence_id));
CREATE POLICY visible_schedule ON core.chore_schedules FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL);
CREATE POLICY visible_revision ON core.chore_revisions FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND (archive_expires_at IS NULL OR archive_expires_at>clock_timestamp()));
CREATE POLICY visible_pool ON core.chore_rotation_members FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND EXISTS(SELECT 1 FROM core.chore_revisions WHERE house_id=chore_rotation_members.house_id AND schedule_id=chore_rotation_members.schedule_id AND revision=chore_rotation_members.revision));
CREATE POLICY visible_activity ON core.activity_events FOR SELECT TO ourhoomu_core_app USING(core.member(house_id) IS NOT NULL AND expires_at>clock_timestamp() AND (bill_id IS NULL OR EXISTS(SELECT 1 FROM core.bills WHERE house_id=activity_events.house_id AND id=activity_events.bill_id)) AND (occurrence_id IS NULL OR EXISTS(SELECT 1 FROM core.chore_occurrences WHERE house_id=activity_events.house_id AND id=activity_events.occurrence_id)));
CREATE POLICY own_cursor ON core.activity_read_state FOR SELECT TO ourhoomu_core_app USING(membership_id=core.member(house_id));

REVOKE ALL ON ALL TABLES IN SCHEMA core FROM ourhoomu_core_app,ourhoomu_core_auth;
GRANT SELECT ON core.users,core.recipient_accounts,core.bills,core.bill_shares,core.payment_attempts,core.payment_confirmations,core.chore_schedules,core.chore_revisions,core.chore_rotation_members,core.chore_occurrences,core.chore_completion_events,core.activity_events,core.activity_read_state TO ourhoomu_core_app;
-- House-scoped IDs, not global identity/user IDs. No account digest/ciphertext in selectors/summaries.
REVOKE SELECT ON core.bills FROM ourhoomu_core_app;
GRANT SELECT(house_id,id,creator_membership_id,recipient_membership_id,title,emoji,total_satang,currency,status,due_date,published_at,voided_at,version,created_at,expires_at,retention_deadline_at) ON core.bills TO ourhoomu_core_app;
GRANT SELECT(id,name,timezone,state,version,created_at) ON core.houses TO ourhoomu_core_app;
GRANT SELECT(house_id,id,role,state,left_at,archived_expires_at,version,created_at) ON core.house_memberships TO ourhoomu_core_app;
GRANT SELECT(house_id,id,creator_membership_id,consumed_at,revoked_at,created_at,expires_at) ON core.house_invitations TO ourhoomu_core_app;
GRANT SELECT(house_id,bill_id,source_account_id,account_version,bank_code,identifier_kind,masked_account,recipient_name,created_at,expires_at) ON core.bill_recipient_snapshots TO ourhoomu_core_app;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_catalog.pg_proc WHERE pronamespace='core'::regnamespace LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO ourhoomu_core_writer',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.signature);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION core.actor(),core.member(uuid),core.command(text,uuid,uuid,jsonb,text,text),core.private_destination(uuid,uuid),core.account_selector(uuid,uuid),core.reader(uuid),core.member_profiles(uuid),core.bill_detail(uuid,uuid),core.resource(text,uuid,uuid),core.dashboard(uuid),core.preview_schedule(uuid,jsonb),core.resolve_payment_house(uuid) TO ourhoomu_core_app;
GRANT EXECUTE ON FUNCTION core.auth_command(text,jsonb),core.clear_replay_secrets() TO ourhoomu_core_auth;

REVOKE CREATE ON SCHEMA core FROM ourhoomu_core_writer;
