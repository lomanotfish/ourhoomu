DO $migration$
DECLARE
  target_oid oid := to_regprocedure('core.private_destination(uuid,uuid)');
  current_source text;
  current_owner oid;
  current_acl aclitem[];
  current_config text[];
  target_lang name;
  current_md5 text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('private-destination-aad-v1', 0));
  IF target_oid IS NULL THEN
    RAISE EXCEPTION 'Refusing private destination AAD rollback: core.private_destination(uuid,uuid) is missing';
  END IF;
  SELECT p.prosrc, p.proowner, p.proacl, p.proconfig, l.lanname
    INTO current_source, current_owner, current_acl, current_config, target_lang
    FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
   WHERE p.oid=target_oid
     AND p.pronargs=2
     AND p.proargtypes[0]='uuid'::regtype
     AND p.proargtypes[1]='uuid'::regtype
     AND p.prorettype='jsonb'::regtype
     AND p.prosecdef;
  IF NOT FOUND OR target_lang<>'plpgsql'
     OR current_config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[] THEN
    RAISE EXCEPTION 'Refusing private destination AAD rollback: function signature or security attributes differ';
  END IF;
  current_md5 := md5(current_source);
  IF current_md5 = 'ec26048eea809fd890d618ba42864213' THEN
    EXECUTE $ddl$CREATE OR REPLACE FUNCTION core.private_destination(h uuid,bid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE m uuid; b core.bills;
BEGIN
 m:=core.member(h); IF m IS NULL THEN PERFORM core.fail('not_found'); END IF;
 SELECT * INTO b FROM core.bills WHERE house_id=h AND id=bid;
 IF b.id IS NULL THEN PERFORM core.fail('not_found'); END IF;
 PERFORM core.require_live(b.expires_at);
 IF b.recipient_membership_id<>m AND NOT EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.amount_satang>(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid AND c.payer_membership_id=m)) THEN PERFORM core.fail('forbidden'); END IF;
 RETURN (SELECT jsonb_build_object('bankCode',bank_code,'identifierKind',identifier_kind,'identifierCiphertext',identifier_ciphertext,'keyVersion',key_version,'recipientName',recipient_name) FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>clock_timestamp());
END $body$;$ddl$;
  ELSIF current_md5 <> 'be739ebd7a4adb72e2a66bad4490dbc9' THEN
    RAISE EXCEPTION 'Refusing private destination AAD rollback: unknown private_destination definition';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
     WHERE p.oid=target_oid
       AND p.proowner=current_owner
       AND p.proacl IS NOT DISTINCT FROM current_acl
       AND p.proconfig IS NOT DISTINCT FROM current_config
       AND p.prosecdef
       AND p.proargtypes[0]='uuid'::regtype
       AND p.proargtypes[1]='uuid'::regtype
       AND p.prorettype='jsonb'::regtype
       AND md5(p.prosrc)='be739ebd7a4adb72e2a66bad4490dbc9'
  ) THEN
    RAISE EXCEPTION 'Refusing private destination AAD rollback: function identity, grants, or final definition changed';
  END IF;
END
$migration$;
