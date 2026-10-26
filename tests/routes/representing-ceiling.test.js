/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const { execSync } = require('child_process')

// Integration test for the x-representing privilege ceiling against the docker-compose mirror.
// A single `users.write` caller (the shape the dispatch bot has) represents two different users:
// an administrator, whose escalation-sensitive permissions must NOT leak to the caller, and a
// dispatcher holding benign extra permissions, whose representation must still succeed (the
// regression the earlier reject-style ceiling introduced and that was rolled back).
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'

const CALLER_TOKEN = 'repceil_caller_token'

const CALLER_GROUP_ID = 'c1c1c1c1-0000-4000-8000-000000000001'
const ADMIN_GROUP_ID = 'c1c1c1c1-0000-4000-8000-000000000002'
const BENIGN_GROUP_ID = 'c1c1c1c1-0000-4000-8000-000000000003'
const TARGET_GROUP_ID = 'c1c1c1c1-0000-4000-8000-000000000004'

const CALLER_USER_ID = 'c1c1c1c1-0000-4000-8000-0000000000a1'
const ADMIN_USER_ID = 'c1c1c1c1-0000-4000-8000-0000000000a2'
const DISPATCHER_USER_ID = 'c1c1c1c1-0000-4000-8000-0000000000a3'

const CLIENT_ID = 'c1c1c1c1-0000-4000-8000-0000000000d4'
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'

const SEED_SQL = `
BEGIN;
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt") VALUES
 ('${CALLER_GROUP_ID}','repceilcaller','RepCeil Caller',10,'{}',ARRAY['users.write']::varchar[],now(),now()),
 ('${ADMIN_GROUP_ID}','repceiladmin','RepCeil Admin',100,'{}',ARRAY['groups.write','users.read','users.write']::varchar[],now(),now()),
 ('${BENIGN_GROUP_ID}','repceilbenign','RepCeil Benign',10,'{}',ARRAY['rescues.write.me','clients.write.me','decals.read']::varchar[],now(),now()),
 ('${TARGET_GROUP_ID}','repceiltarget','RepCeil Target',10,'{}',ARRAY[]::varchar[],now(),now());
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${CALLER_USER_ID}','repceil-caller@fuelrats.test','disabled','active',now(),now()),
 ('${ADMIN_USER_ID}','repceil-admin@fuelrats.test','disabled','active',now(),now()),
 ('${DISPATCHER_USER_ID}','repceil-dispatcher@fuelrats.test','disabled','active',now(),now());
INSERT INTO "UserGroups"(id,"userId","groupId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${CALLER_USER_ID}','${CALLER_GROUP_ID}',now(),now()),
 (gen_random_uuid(),'${ADMIN_USER_ID}','${ADMIN_GROUP_ID}',now(),now()),
 (gen_random_uuid(),'${DISPATCHER_USER_ID}','${BENIGN_GROUP_ID}',now(),now());
INSERT INTO "Clients"(id,name,secret,"userId","firstParty","createdAt","updatedAt") VALUES
 ('${CLIENT_ID}','repceil-client','${SEED_SECRET}','${CALLER_USER_ID}',true,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${CALLER_TOKEN}',ARRAY['*']::varchar[],'${CALLER_USER_ID}','${CLIENT_ID}',now(),now());
COMMIT;
`

const CLEANUP_SQL = `
DELETE FROM "Tokens" WHERE value = '${CALLER_TOKEN}';
DELETE FROM "UserGroups" WHERE "userId" IN ('${CALLER_USER_ID}','${ADMIN_USER_ID}','${DISPATCHER_USER_ID}');
DELETE FROM "Clients" WHERE id = '${CLIENT_ID}';
DELETE FROM "Users" WHERE id IN ('${CALLER_USER_ID}','${ADMIN_USER_ID}','${DISPATCHER_USER_ID}');
DELETE FROM "Groups" WHERE id IN ('${CALLER_GROUP_ID}','${ADMIN_GROUP_ID}','${BENIGN_GROUP_ID}','${TARGET_GROUP_ID}');
`

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

const client = (representing) => {
  const headers = { authorization: `Bearer ${CALLER_TOKEN}` }
  if (representing) {
    headers['x-representing'] = representing
  }
  return Axios.create({ baseURL: BASE, timeout: 5000, validateStatus: () => true, headers })
}

beforeAll(() => {
  runSql(CLEANUP_SQL)
  runSql(SEED_SQL)
})

afterAll(() => {
  runSql(CLEANUP_SQL)
})

describe('x-representing privilege ceiling', () => {
  it('does not grant the caller users.read by representing an administrator', async () => {
    const baseline = await client().get('/users')
    expect(baseline.status).toBe(403)

    const represented = await client(ADMIN_USER_ID).get('/users')
    expect(represented.status).toBe(403)
  })

  it('does not grant the caller groups.write by representing an administrator', async () => {
    const response = await client(ADMIN_USER_ID).put(
      `/groups/${TARGET_GROUP_ID}/permissions/decals.read`,
      {},
      { headers: { 'content-type': 'application/vnd.api+json' } },
    )
    expect(response.status).toBe(403)
  })

  it('still allows representing a user who holds benign extra permissions (dispatch path)', async () => {
    const response = await client(DISPATCHER_USER_ID).get('/profile')
    expect(response.status).toBe(200)
    expect(response.data.data.id).toBe(DISPATCHER_USER_ID)
  })
})
