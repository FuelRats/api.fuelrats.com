/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const { execSync } = require('child_process')

// Integration test for POST /irc/sasl-token on an API with FRAPI_IRC_TOKEN_SECRET unset. It shares the
// mirror's database, so it can run against a one-off container of the mirror's api service, for example:
//   docker compose run -d --rm --no-deps --name <name> -e FRAPI_IRC_TOKEN_SECRET= -p 18081:8080 api
//   FRAPI_TEST_URL=http://localhost:18081 bun test tests/routes/irc-sasl-token-unconfigured.test.js
// The seeded user has no Anope account, so an API that has the secret answers 400 here instead of 503.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'

const USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000b1'
const USER_EMAIL = 'sasl-token-unconfigured@fuelrats.test'
const CLIENT_ID = 'e3e3e3e3-0000-4000-8000-0000000000d1'
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'
const FULL_SCOPE_TOKEN = 'irctestunconfiguredtoken00000001'
const NO_IRC_SCOPE_TOKEN = 'irctestunconfiguredratsread00001'

const cleanupSql = `
DELETE FROM "Tokens" WHERE "clientId" = '${CLIENT_ID}' OR "userId" = '${USER_ID}';
DELETE FROM "Clients" WHERE id = '${CLIENT_ID}';
DELETE FROM "Users" WHERE id = '${USER_ID}';
`

const seedSql = `
BEGIN;
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_ID}','${USER_EMAIL}','disabled','active',now(),now());
INSERT INTO "Clients"(id,name,secret,"redirectUri","userId","firstParty","public","createdAt","updatedAt") VALUES
 ('${CLIENT_ID}','SASL Token Unconfigured Test Website','${SEED_SECRET}',NULL,'${USER_ID}',true,false,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${FULL_SCOPE_TOKEN}',ARRAY['*']::varchar[],'${USER_ID}','${CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${NO_IRC_SCOPE_TOKEN}',ARRAY['rats.read.me']::varchar[],'${USER_ID}','${CLIENT_ID}',now(),now());
COMMIT;
`

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

const api = Axios.create({
  baseURL: BASE,
  timeout: 10000,
  validateStatus: () => true,
})

const saslToken = (bearer) => {
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : {}
  return api.post('/irc/sasl-token', {}, { headers })
}

beforeAll(() => {
  runSql(cleanupSql)
  runSql(seedSql)
})

afterAll(() => {
  runSql(cleanupSql)
})

describe('POST /irc/sasl-token without a token secret', () => {
  it('returns 503 to an authorised caller', async () => {
    const response = await saslToken(FULL_SCOPE_TOKEN)
    expect(response.status).toBe(503)
    expect(response.data.errors[0].status).toBe('service_unavailable')
    expect(response.data.password).toBeUndefined()
  })

  it('still checks authentication and the irc.login permission first', async () => {
    expect((await saslToken(null)).status).toBe(401)
    expect((await saslToken(NO_IRC_SCOPE_TOKEN)).status).toBe(403)
  })
})
