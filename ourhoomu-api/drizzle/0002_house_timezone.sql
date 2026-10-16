-- Patch only the accepted house.update branch, preserving session locks, ownership and grants.
DO $migration$
DECLARE
  definition text := pg_catalog.pg_get_functiondef('core.command(text,uuid,uuid,jsonb,text,text)'::regprocedure);
  previous text := $old$UPDATE core.houses SET name=p->>'name',version=version+1 WHERE id=h;$old$;
  replacement text := $new$IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p->>'timezone') THEN PERFORM core.fail('validation_error'); END IF;
 UPDATE core.houses SET name=p->>'name',timezone=p->>'timezone',version=version+1 WHERE id=h;$new$;
BEGIN
  IF pg_catalog.strpos(definition,replacement)>0 THEN
    RETURN;
  END IF;
  IF (pg_catalog.length(definition)-pg_catalog.length(pg_catalog.replace(definition,previous,'')))<>pg_catalog.length(previous) THEN
    RAISE EXCEPTION 'Unexpected core.command definition; refusing timezone patch';
  END IF;
  EXECUTE pg_catalog.replace(definition,previous,replacement);
END $migration$;
