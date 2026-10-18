-- ALTER OWNER of new routines requires CREATE for the destination owner.
-- The accepted schema revokes it; grant only inside the migration transaction.
GRANT CREATE ON SCHEMA core TO ourhoomu_core_writer;
-- Reversal metadata contains function definitions only; never application secrets.
CREATE TABLE core.http_seam_migration_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 command_definition text NOT NULL,
 clear_definition text NOT NULL,
 migration_sha text,
 applied_hashes jsonb
);
INSERT INTO core.http_seam_migration_state(singleton,command_definition,clear_definition)
VALUES(true,pg_get_functiondef('core.command(text,uuid,uuid,jsonb,text,text)'::regprocedure),pg_get_functiondef('core.clear_replay_secrets()'::regprocedure));
REVOKE ALL ON core.http_seam_migration_state FROM PUBLIC,ourhoomu_core_app,ourhoomu_core_auth;
ALTER TABLE core.http_seam_migration_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.http_seam_migration_state FORCE ROW LEVEL SECURITY;
CREATE POLICY migration_owner ON core.http_seam_migration_state TO neondb_owner USING(true) WITH CHECK(true);
-- Additive HTTP seam. Never resets schemas, roles, or accepted migration files.
CREATE TABLE core.auth_request_locators (
 route text NOT NULL CHECK(route IN ('challenge','exchange')),
 key_digest text NOT NULL CHECK(key_digest ~ '^[0-9a-f]{64}$'),
 body_hash text NOT NULL CHECK(body_hash ~ '^[0-9a-f]{64}$'),
 challenge_id uuid NOT NULL,
 session_id uuid REFERENCES core.sessions(id),
 replay_ciphertext text,
 replay_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(route,key_digest),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '24 hours'),
 CHECK((route='challenge' AND session_id IS NULL AND replay_ciphertext IS NULL AND replay_until IS NULL)
 OR (route='exchange' AND session_id IS NOT NULL AND replay_until>created_at AND replay_until<=created_at+interval '5 minutes'))
);
CREATE INDEX auth_locator_expiry ON core.auth_request_locators(expires_at);
ALTER TABLE core.auth_request_locators ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.auth_request_locators FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON core.auth_request_locators TO ourhoomu_core_writer;
CREATE POLICY writer_all ON core.auth_request_locators TO ourhoomu_core_writer USING(true) WITH CHECK(true);
ALTER TABLE core.idempotency_records ADD COLUMN result_data jsonb;
-- Original routine remains private; only the wrapper accepts auth-role calls.
ALTER FUNCTION core.auth_command(text,jsonb) RENAME TO auth_command_before_http;
REVOKE ALL ON FUNCTION core.auth_command_before_http(text,jsonb) FROM ourhoomu_core_auth,ourhoomu_core_app,PUBLIC;
CREATE FUNCTION core.auth_command(op text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE loc core.auth_request_locators; ch core.auth_challenges; s core.sessions;
 result jsonb; n timestamptz:=statement_timestamp();
BEGIN
 IF op NOT IN ('challenge','exchange') THEN RETURN core.auth_command_before_http(op,p); END IF;
 IF p IS NULL OR jsonb_typeof(p)<>'object' OR coalesce(p->>'keyDigest','') !~ '^[0-9a-f]{64}$'
 OR coalesce(p->>'bodyHash','') !~ '^[0-9a-f]{64}$' OR coalesce(p->>'proofDigest','') !~ '^[0-9a-f]{64}$'
 OR coalesce(p->>'provider','') NOT IN ('google','apple') THEN PERFORM core.fail('validation_error'); END IF;
 -- Stable anonymous route/key serialization; no raw key, token, nonce or PII stored here.
 PERFORM pg_advisory_xact_lock(hashtextextended('auth-http:'||op||':'||(p->>'keyDigest'),0));
 DELETE FROM core.auth_request_locators WHERE expires_at<=clock_timestamp();
 DELETE FROM core.auth_challenges c WHERE c.expires_at<=clock_timestamp()
 AND NOT EXISTS(SELECT 1 FROM core.auth_request_locators l WHERE l.challenge_id=c.id);
 SELECT * INTO loc FROM core.auth_request_locators WHERE route=op AND key_digest=p->>'keyDigest';
 IF loc.key_digest IS NOT NULL AND loc.body_hash IS DISTINCT FROM p->>'bodyHash' THEN PERFORM core.fail('idempotency_conflict'); END IF;
 IF op='challenge' THEN
  IF loc.key_digest IS NOT NULL THEN
   SELECT * INTO ch FROM core.auth_challenges WHERE id=loc.challenge_id;
   IF ch.id IS NULL OR ch.expires_at<=clock_timestamp() OR ch.provider IS DISTINCT FROM p->>'provider'
   OR ch.proof_digest IS DISTINCT FROM p->>'proofDigest' THEN PERFORM core.fail('unauthenticated'); END IF;
   RETURN jsonb_build_object('challengeId',ch.id,'expiresAt',ch.expires_at,'replayed',true);
  END IF;
  INSERT INTO core.auth_challenges(provider,proof_digest,expires_at)
  VALUES(p->>'provider',p->>'proofDigest',n+interval '5 minutes') RETURNING * INTO ch;
  INSERT INTO core.auth_request_locators(route,key_digest,body_hash,challenge_id,expires_at)
  VALUES(op,p->>'keyDigest',p->>'bodyHash',ch.id,n+interval '24 hours');
  RETURN jsonb_build_object('challengeId',ch.id,'expiresAt',ch.expires_at,'replayed',false);
 END IF;
 SELECT * INTO ch FROM core.auth_challenges WHERE id=(p->>'challengeId')::uuid FOR UPDATE;
 IF ch.id IS NULL OR ch.provider IS DISTINCT FROM p->>'provider' OR ch.proof_digest IS DISTINCT FROM p->>'proofDigest'
 THEN PERFORM core.fail('unauthenticated'); END IF;
 IF loc.key_digest IS NOT NULL THEN
  IF loc.challenge_id<>ch.id OR ch.consumed_at IS NULL OR loc.replay_until<=clock_timestamp()
  OR loc.replay_ciphertext IS NULL THEN PERFORM core.fail('unauthenticated'); END IF;
  SELECT * INTO s FROM core.sessions WHERE id=loc.session_id;
  -- Same family-root lock as rotate/revoke; re-read AFTER waiting, with fresh snapshots.
  PERFORM 1 FROM core.sessions WHERE family_id=s.family_id ORDER BY generation,id LIMIT 1 FOR SHARE;
  SELECT * INTO s FROM core.sessions WHERE id=loc.session_id;
  SELECT * INTO loc FROM core.auth_request_locators WHERE route=op AND key_digest=p->>'keyDigest';
  IF s.id IS NULL OR s.revoked_at IS NOT NULL OR s.rotated_at IS NOT NULL OR s.expires_at<=clock_timestamp()
  OR s.refresh_expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM core.sessions WHERE family_id=s.family_id AND revoked_at IS NOT NULL)
  OR NOT EXISTS(SELECT 1 FROM core.users WHERE id=s.user_id AND state='active')
  OR loc.key_digest IS NULL OR loc.replay_ciphertext IS NULL OR loc.replay_until<=clock_timestamp()
  OR loc.expires_at<=clock_timestamp() THEN PERFORM core.fail('unauthenticated'); END IF;
  RETURN jsonb_build_object('replayed',true,'replayCiphertext',loc.replay_ciphertext);
 END IF;
 IF ch.consumed_at IS NOT NULL OR ch.expires_at<=clock_timestamp() THEN PERFORM core.fail('unauthenticated'); END IF;
 IF p->'checkReplay'='true'::jsonb THEN RETURN jsonb_build_object('pending',true); END IF;
 -- Verified claims originate only from the server issuer adapter, never caller userId.
 IF coalesce(length(p->>'issuer'),0) NOT BETWEEN 1 AND 512 OR coalesce(length(p->>'subject'),0) NOT BETWEEN 1 AND 512
 OR coalesce(length(p->>'displayName'),0) NOT BETWEEN 1 AND 100
 OR coalesce(p->>'accessDigest','') !~ '^[0-9a-f]{64}$' OR coalesce(p->>'refreshDigest','') !~ '^[0-9a-f]{64}$'
 OR coalesce(length(p->>'replayCiphertext'),0)<32 OR p->>'authTime' IS NULL
 OR (p->>'authTime')::timestamptz>clock_timestamp()+interval '120 seconds'
 OR p->>'expiresAt' IS NULL OR (p->>'expiresAt')::timestamptz<=clock_timestamp()
 OR p->>'refreshExpiresAt' IS NULL THEN PERFORM core.fail('validation_error'); END IF;
 result:=core.auth_command_before_http('exchange',p);
 SELECT * INTO s FROM core.sessions WHERE id=(result->>'sessionId')::uuid;
 INSERT INTO core.auth_request_locators(route,key_digest,body_hash,challenge_id,session_id,replay_ciphertext,replay_until,expires_at)
 VALUES(op,p->>'keyDigest',p->>'bodyHash',ch.id,s.id,p->>'replayCiphertext',least(n+interval '5 minutes',s.expires_at),n+interval '24 hours');
 RETURN jsonb_build_object('replayed',false,'replayCiphertext',p->>'replayCiphertext');
END $$;
ALTER FUNCTION core.auth_command(text,jsonb) OWNER TO ourhoomu_core_writer;
REVOKE ALL ON FUNCTION core.auth_command(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.auth_command(text,jsonb) TO ourhoomu_core_auth;

CREATE FUNCTION core.http_projection(kind text,h uuid DEFAULT NULL,rid uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid:=core.actor(); m uuid; result jsonb;
BEGIN
 IF uid IS NULL THEN PERFORM core.fail('unauthenticated'); END IF;
 IF kind IN ('house','ownMembership','targetMembership','invitation') THEN
  m:=core.reader(h);
 END IF;
 CASE kind
 WHEN 'me' THEN
  SELECT jsonb_build_object('id',id,'displayName',display_name) INTO result FROM core.users WHERE id=uid;
 WHEN 'house' THEN
  SELECT jsonb_build_object('id',id,'name',name,'timezone',timezone,'version',version) INTO result FROM core.houses WHERE id=h AND state='active';
 WHEN 'ownMembership' THEN
  SELECT jsonb_build_object('id',id,'version',version) INTO result FROM core.house_memberships WHERE house_id=h AND id=m AND state='active';
 WHEN 'targetMembership' THEN
  IF NOT EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=h AND id=m AND role='owner') THEN PERFORM core.fail('forbidden'); END IF;
  SELECT jsonb_build_object('id',id,'version',version) INTO result FROM core.house_memberships WHERE house_id=h AND id=rid AND (state='active' OR archived_expires_at>clock_timestamp());
 WHEN 'account','accountSecret' THEN
  SELECT CASE WHEN kind='accountSecret' THEN jsonb_build_object('bankCode',bank_code,'identifierCiphertext',identifier_ciphertext,'identifierDigest',identifier_digest,'keyVersion',key_version)
  ELSE jsonb_build_object('id',id,'version',version,'bankCode',bank_code,'label',label,'maskedAccount',masked_account,'isDefault',is_default,'active',state='active') END
  INTO result FROM core.recipient_accounts WHERE id=rid AND owner_user_id=uid AND (state='active' OR archived_expires_at>clock_timestamp());
 WHEN 'invitation' THEN
  IF NOT EXISTS(SELECT 1 FROM core.house_memberships WHERE house_id=h AND id=m AND role='owner') THEN PERFORM core.fail('forbidden'); END IF;
  SELECT jsonb_build_object('id',id,'houseId',house_id,'expiresAt',expires_at,'createdAt',created_at,'status',CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN consumed_at IS NOT NULL THEN 'consumed' ELSE 'active' END)
  INTO result FROM core.house_invitations WHERE house_id=h AND id=rid AND expires_at>clock_timestamp();
 ELSE PERFORM core.fail('feature_unavailable');
 END CASE;
 IF result IS NULL THEN PERFORM core.fail('not_found'); END IF;
 RETURN result;
END $$;
ALTER FUNCTION core.http_projection(text,uuid,uuid) OWNER TO ourhoomu_core_writer;
REVOKE ALL ON FUNCTION core.http_projection(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.http_projection(text,uuid,uuid) TO ourhoomu_core_app;

-- Exact definition anchors refuse an unknown predecessor rather than weakening accepted checks.
DO $patch$
DECLARE definition text:=pg_get_functiondef('core.command(text,uuid,uuid,jsonb,text,text)'::regprocedure); previous text; replacement text;
BEGIN
 previous:=$old$replay_cipher text; replay_until timestamptz;$old$;
 replacement:=$new$replay_cipher text; replay_until timestamptz; result_data jsonb;$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$old$replay_cipher:=p->>'replayCiphertext';replay_until:=n+interval '5 minutes';result_kind:='invitation';$old$;
 replacement:=$new$replay_cipher:=p->>'replayCiphertext';replay_until:=least(n+interval '5 minutes',e);result_kind:='invitation';$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$old$e:=n+interval '168 hours';d:=e+interval '24 hours';$old$;
 replacement:=$new$IF jsonb_typeof(p->'expiresInSeconds') IS DISTINCT FROM 'number' OR (p->>'expiresInSeconds') !~ '^[0-9]+$' OR (p->>'expiresInSeconds')::numeric NOT BETWEEN 1 AND 604800 THEN PERFORM core.fail('validation_error'); END IF;
e:=n+make_interval(secs=>(p->>'expiresInSeconds')::integer); d:=e+interval '24 hours';$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$old$RETURN jsonb_build_object('resourceId',old.resource_id,'resourceKind',old.resource_kind,'replayed',true,'replayCiphertext',CASE WHEN old.replay_until>clock_timestamp() THEN old.replay_ciphertext END);$old$;
 replacement:=$new$IF op IN ('member.leave','member.remove','invite.accept') AND (old.replay_until IS NULL OR old.replay_until<=clock_timestamp()) THEN PERFORM core.fail('idempotency_conflict'); END IF;
RETURN jsonb_build_object('resourceId',old.resource_id,'resourceKind',old.resource_kind,'replayed',true,'replayCiphertext',CASE WHEN old.replay_until>clock_timestamp() THEN old.replay_ciphertext END,'data',CASE WHEN old.replay_until>clock_timestamp() THEN old.result_data END);$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$old$INSERT INTO core.idempotency_records(actor_user_id,house_id,route_scope,key_digest,request_hash,resource_kind,resource_id,replay_ciphertext,replay_until,expires_at,retention_deadline_at)$old$;
 replacement:=$new$IF op IN ('member.leave','member.remove','invite.accept') THEN
 SELECT jsonb_build_object('id',m2.id,'displayName',u.display_name,'role',m2.role,'active',m2.state='active','version',m2.version)
 || CASE WHEN m2.state<>'active' THEN jsonb_build_object('removedAt',m2.left_at) ELSE '{}'::jsonb END
 INTO result_data FROM core.house_memberships m2 JOIN core.users u ON u.id=m2.user_id WHERE m2.house_id=h AND m2.id=result_id;
 replay_until:=least(n+interval '5 minutes',e);
END IF;
INSERT INTO core.idempotency_records(actor_user_id,house_id,route_scope,key_digest,request_hash,resource_kind,resource_id,replay_ciphertext,replay_until,expires_at,retention_deadline_at,result_data)$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$old$VALUES(uid,h,scope,k,bh,result_kind,result_id,replay_cipher,replay_until,least(e,statement_timestamp()+interval '8736 hours'),least(d,statement_timestamp()+interval '8760 hours'));$old$;
 replacement:=$new$VALUES(uid,h,scope,k,bh,result_kind,result_id,replay_cipher,replay_until,least(e,statement_timestamp()+interval '8736 hours'),least(d,statement_timestamp()+interval '8760 hours'),result_data);$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 previous:=$old$RETURN jsonb_build_object('resourceId',result_id,'resourceKind',result_kind,'replayed',false,'replayCiphertext',replay_cipher);$old$;
 replacement:=$new$RETURN jsonb_build_object('resourceId',result_id,'resourceKind',result_kind,'replayed',false,'replayCiphertext',replay_cipher,'data',result_data);$new$;
 IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown core.command predecessor for HTTP seam'; END IF;
 definition:=replace(definition,previous,replacement);
 EXECUTE definition;
END $patch$;

REVOKE CREATE ON SCHEMA core FROM ourhoomu_core_writer;

-- Runtime janitor is separately authorized; clear expired encrypted results and anonymous ledgers.
DO $patch$
DECLARE definition text:=pg_get_functiondef('core.clear_replay_secrets()'::regprocedure); previous text; replacement text;
BEGIN
 definition:=replace(definition,'BEGIN','BEGIN
 DELETE FROM core.auth_request_locators WHERE expires_at<=clock_timestamp();
 UPDATE core.auth_request_locators SET replay_ciphertext=NULL WHERE replay_until<=clock_timestamp();
 DELETE FROM core.auth_challenges c WHERE c.expires_at<=clock_timestamp() AND NOT EXISTS(SELECT 1 FROM core.auth_request_locators l WHERE l.challenge_id=c.id);
');
previous:=$old$UPDATE core.idempotency_records SET replay_ciphertext=NULL,replay_until=NULL WHERE replay_until<=clock_timestamp();$old$;
replacement:=$new$UPDATE core.idempotency_records SET replay_ciphertext=NULL,replay_until=NULL,result_data=NULL WHERE replay_until<=clock_timestamp() OR (replay_until IS NULL AND result_data IS NOT NULL);$new$;
IF (length(definition)-length(replace(definition,previous,'')))<>length(previous) THEN RAISE EXCEPTION 'Unknown clear_replay_secrets predecessor for HTTP seam'; END IF;
definition:=replace(definition,previous,replacement);
 EXECUTE definition;
END $patch$;
