DO $migration$
DECLARE
 target_oid oid := to_regprocedure('core.bill_detail(uuid,uuid)');
 current_source text; current_owner oid; current_acl aclitem[]; current_config text[]; target_lang name; current_md5 text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('bill-detail-actions-v1',0));
 IF target_oid IS NULL THEN RAISE EXCEPTION 'bill detail actions rollback: function missing'; END IF;
 SELECT p.prosrc,p.proowner,p.proacl,p.proconfig,l.lanname INTO current_source,current_owner,current_acl,current_config,target_lang
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=target_oid AND p.pronargs=2
 AND p.proargtypes[0]='uuid'::regtype AND p.proargtypes[1]='uuid'::regtype AND p.prorettype='jsonb'::regtype AND p.prosecdef;
 IF NOT FOUND OR target_lang<>'plpgsql' OR current_config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR current_owner<>'ourhoomu_core_writer'::regrole OR current_acl IS DISTINCT FROM ARRAY[
 'ourhoomu_core_writer=X/ourhoomu_core_writer'::aclitem,'ourhoomu_core_app=X/ourhoomu_core_writer'::aclitem] THEN
  RAISE EXCEPTION 'bill detail actions rollback: function identity or security attributes differ';
 END IF;
 current_md5:=md5(current_source);
 IF current_md5='995b2caafec89212c9409d849e1bde44' THEN
  EXECUTE $ddl$CREATE OR REPLACE FUNCTION core.bill_detail(h uuid,bid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE m uuid:=core.reader(h);b core.bills;masked jsonb;shares jsonb;private_account jsonb;
BEGIN
 SELECT * INTO b FROM core.bills WHERE house_id=h AND id=bid;
 IF b.id IS NULL THEN PERFORM core.fail('not_found'); END IF;PERFORM core.require_live(b.expires_at);
 SELECT jsonb_build_object('sourceAccountId',source_account_id,'accountVersion',account_version,'bankCode',bank_code,'identifierKind',identifier_kind,'maskedAccount',masked_account,'recipientName',recipient_name) INTO masked FROM core.bill_recipient_snapshots WHERE house_id=h AND bill_id=bid AND expires_at>clock_timestamp();
 SELECT coalesce(jsonb_agg(to_jsonb(s)-'retention_deadline_at'||jsonb_build_object('confirmed_satang',coalesce(c.amount,0)::text,'remaining_satang',CASE WHEN s.self_covered THEN '0' ELSE (s.amount_satang-coalesce(c.amount,0))::text END)),'[]'::jsonb) INTO shares FROM core.bill_shares s LEFT JOIN LATERAL(SELECT sum(amount_satang) amount FROM core.payment_confirmations WHERE house_id=h AND bill_id=bid AND payer_membership_id=s.membership_id AND expires_at>clock_timestamp()) c ON true WHERE s.house_id=h AND s.bill_id=bid AND s.expires_at>clock_timestamp();
 IF b.recipient_membership_id=m OR EXISTS(SELECT 1 FROM core.bill_shares s WHERE s.house_id=h AND s.bill_id=bid AND s.membership_id=m AND NOT s.self_covered AND s.amount_satang>(SELECT coalesce(sum(c.amount_satang),0) FROM core.payment_confirmations c WHERE c.house_id=h AND c.bill_id=bid AND c.payer_membership_id=m)) THEN private_account:=core.private_destination(h,bid);END IF;
 RETURN (to_jsonb(b)-'recipient_user_id'-'retention_deadline_at')||jsonb_build_object('shares',shares,'recipientAccountMasked',masked,'recipientAccountEncrypted',private_account);
END $body$;$ddl$;
 ELSIF current_md5<>'161704d41ad0681f0333a82508718a49' THEN RAISE EXCEPTION 'Refusing bill detail actions rollback: unknown function definition';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=target_oid AND p.proowner=current_owner AND p.proacl IS NOT DISTINCT FROM current_acl
  AND p.proconfig IS NOT DISTINCT FROM current_config AND p.prosecdef AND p.proargtypes[0]='uuid'::regtype
  AND p.proargtypes[1]='uuid'::regtype AND p.prorettype='jsonb'::regtype AND md5(p.prosrc)='161704d41ad0681f0333a82508718a49') THEN
  RAISE EXCEPTION 'Refusing bill detail actions rollback: identity, grants, or restored definition changed';
 END IF;
END
$migration$;
