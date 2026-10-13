\set ON_ERROR_STOP on

-- Run only with the authorized synthetic branch's MIGRATION_DATABASE_URL.
CREATE SCHEMA runtime_probe;
CREATE ROLE ourhoomu_runtime_probe LOGIN PASSWORD :'runtime_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
-- Database CONNECT is inherited from the branch's database grants.

CREATE TABLE runtime_probe.visible_rows (
  actor_id uuid PRIMARY KEY,
  secret text NOT NULL
);
CREATE TABLE runtime_probe.rollback_probe (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  marker text NOT NULL
);
INSERT INTO runtime_probe.visible_rows (actor_id, secret) VALUES
  ('11111111-1111-4111-8111-111111111111', 'synthetic-actor-a'),
  ('22222222-2222-4222-8222-222222222222', 'synthetic-actor-b');

ALTER TABLE runtime_probe.visible_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE runtime_probe.visible_rows FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_probe_actor_rows ON runtime_probe.visible_rows
  USING (actor_id = nullif(current_setting('app.actor_id', true), '')::uuid)
  WITH CHECK (actor_id = nullif(current_setting('app.actor_id', true), '')::uuid);

GRANT USAGE ON SCHEMA runtime_probe TO ourhoomu_runtime_probe;
GRANT SELECT ON runtime_probe.visible_rows TO ourhoomu_runtime_probe;
GRANT INSERT ON runtime_probe.rollback_probe TO ourhoomu_runtime_probe;
GRANT USAGE, SELECT ON SEQUENCE runtime_probe.rollback_probe_id_seq TO ourhoomu_runtime_probe;
