-- Marks the migrations already contained in development database dumps that
-- predate the SequelizeMeta table, so `bun run db:migrate` applies only the rest.
-- Run once, right after restoring such a dump.
CREATE TABLE IF NOT EXISTS "SequelizeMeta" (name VARCHAR(255) NOT NULL PRIMARY KEY);
INSERT INTO "SequelizeMeta" (name) VALUES
  ('20200422165711-apiv3-migration.js'),
  ('20250830154840-add-jira-roles-to-groups.js'),
  ('20260414000000-add-display-name-to-groups.js'),
  ('20260414000001-add-carrier-to-rescues.js'),
  ('20260416000000-add-recovery-codes-to-authenticators.js'),
  ('20260417000000-merge-sessions-into-tokens.js'),
  ('20260422000000-add-rescue-dispatchers.js')
ON CONFLICT DO NOTHING;
