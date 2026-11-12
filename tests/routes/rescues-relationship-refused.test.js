/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const { execSync } = require('child_process')

// Integration test against the docker-compose mirror. Each request sets rats (accepted) together with a dispatchers
// change that is refused, so the rats change has already started on the request transaction when the refusal comes.
// The request must wait for it before rolling back: the API answers the error, writes nothing and keeps serving.
//   - update: a `rescues.write.me` user may set rats but not dispatchers (needs dispatch.write), 403;
//   - create: a `rescues.write` user sends dispatchers as an object instead of an array, 422.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'

const RAT_TOKEN = 'relrefused_rat_token'
const WRITER_TOKEN = 'relrefused_writer_token'
const RAT_GROUP_ID = 'd2d2d2d2-0000-4000-8000-000000000001'
const WRITER_GROUP_ID = 'd2d2d2d2-0000-4000-8000-000000000002'
const RAT_USER_ID = 'd2d2d2d2-0000-4000-8000-0000000000a1'
const WRITER_USER_ID = 'd2d2d2d2-0000-4000-8000-0000000000a2'
const RAT_ID = 'd2d2d2d2-0000-4000-8000-0000000000b1'
const RESCUE_ID = 'd2d2d2d2-0000-4000-8000-0000000000c1'
const CLIENT_ID = 'd2d2d2d2-0000-4000-8000-0000000000d1'
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'
const CREATE_CLIENT = 'Relrefused Create'
const SETTLE_MS = 1500

const SEED_SQL = `
BEGIN;
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt") VALUES
 ('${RAT_GROUP_ID}','relrefusedrat','Relrefused Rat',10,'{}',ARRAY['rescues.write.me','rescues.read.me']::varchar[],now(),now()),
 ('${WRITER_GROUP_ID}','relrefusedwriter','Relrefused Writer',10,'{}',ARRAY['rescues.write','rescues.read']::varchar[],now(),now());
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${RAT_USER_ID}','relrefused-rat@fuelrats.test','disabled','active',now(),now()),
 ('${WRITER_USER_ID}','relrefused-writer@fuelrats.test','disabled','active',now(),now());
INSERT INTO "UserGroups"(id,"userId","groupId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${RAT_USER_ID}','${RAT_GROUP_ID}',now(),now()),
 (gen_random_uuid(),'${WRITER_USER_ID}','${WRITER_GROUP_ID}',now(),now());
INSERT INTO "Clients"(id,name,secret,"userId","firstParty","createdAt","updatedAt") VALUES
 ('${CLIENT_ID}','relrefused-client','${SEED_SECRET}','${RAT_USER_ID}',true,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${RAT_TOKEN}',ARRAY['*']::varchar[],'${RAT_USER_ID}','${CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${WRITER_TOKEN}',ARRAY['*']::varchar[],'${WRITER_USER_ID}','${CLIENT_ID}',now(),now());
INSERT INTO "Rats"(id,name,platform,expansion,"userId","createdAt","updatedAt") VALUES
 ('${RAT_ID}','Relrefused Rat','pc','odyssey','${RAT_USER_ID}',now(),now());
INSERT INTO "Rescues"(id,client,"createdAt","updatedAt") VALUES
 ('${RESCUE_ID}','Relrefused Client',now(),now());
COMMIT;
`

const CLEANUP_SQL = `
DELETE FROM "RescueRats" WHERE "ratId" = '${RAT_ID}';
DELETE FROM "RescueDispatchers" WHERE "userId" IN ('${RAT_USER_ID}','${WRITER_USER_ID}');
DELETE FROM "Rescues" WHERE id = '${RESCUE_ID}' OR client = '${CREATE_CLIENT}';
DELETE FROM "Rats" WHERE id = '${RAT_ID}';
DELETE FROM "Tokens" WHERE value IN ('${RAT_TOKEN}','${WRITER_TOKEN}');
DELETE FROM "Clients" WHERE id = '${CLIENT_ID}';
DELETE FROM "UserGroups" WHERE "userId" IN ('${RAT_USER_ID}','${WRITER_USER_ID}');
DELETE FROM "Users" WHERE id IN ('${RAT_USER_ID}','${WRITER_USER_ID}');
DELETE FROM "Groups" WHERE id IN ('${RAT_GROUP_ID}','${WRITER_GROUP_ID}');
`

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

const queryCount = (sql) => {
  const output = execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -At`, { input: sql })
  return Number(output.toString().trim())
}

const client = (token) => {
  return Axios.create({
    baseURL: BASE,
    timeout: 5000,
    validateStatus: () => true,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/vnd.api+json' },
  })
}

const ratsRelationship = { data: [{ type: 'rats', id: RAT_ID }] }

const settle = () => {
  return new Promise((resolve) => {
    setTimeout(resolve, SETTLE_MS)
  })
}

const expectApiAlive = async () => {
  const response = await Axios.get(`${BASE}/.well-known/openid-configuration`, {
    timeout: 5000,
    validateStatus: () => true,
  })
  expect(response.status).toBe(200)
}

beforeAll(() => {
  runSql(CLEANUP_SQL)
  runSql(SEED_SQL)
})

afterAll(() => {
  runSql(CLEANUP_SQL)
})

describe('rescue relationship change refused part-way', () => {
  it('PUT answers 403, rolls back the rats change and the API keeps running', async () => {
    const response = await client(RAT_TOKEN).put(`/rescues/${RESCUE_ID}`, {
      data: {
        type: 'rescues',
        id: RESCUE_ID,
        relationships: {
          rats: ratsRelationship,
          dispatchers: { data: [{ type: 'users', id: RAT_USER_ID }] },
        },
      },
    })
    expect(response.status).toBe(403)

    await settle()
    await expectApiAlive()
    expect(queryCount(`SELECT count(*) FROM "RescueRats" WHERE "rescueId" = '${RESCUE_ID}';`)).toBe(0)
  })

  it('POST answers 422, creates no rescue and the API keeps running', async () => {
    const response = await client(WRITER_TOKEN).post('/rescues', {
      data: {
        type: 'rescues',
        attributes: { client: CREATE_CLIENT, platform: 'pc', expansion: 'odyssey' },
        relationships: {
          rats: ratsRelationship,
          dispatchers: { data: { type: 'users', id: WRITER_USER_ID } },
        },
      },
    })
    expect(response.status).toBe(422)

    await settle()
    await expectApiAlive()
    expect(queryCount(`SELECT count(*) FROM "Rescues" WHERE client = '${CREATE_CLIENT}';`)).toBe(0)
  })
})
