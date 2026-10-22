/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const { execSync } = require('child_process')

// Integration test for GET /rescues/me against the docker-compose mirror. Seeds a disposable user who has no rats,
// which is the case where the first-limpet filter has no rat IDs to match.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'

const TOKEN = 'rescues_me_test_token'
const USER_ID = 'eeee1111-0000-4000-8000-000000000001'

const SEED_SQL = `
BEGIN;
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_ID}','rescues-me-test@fuelrats.test','disabled','active',now(),now());
INSERT INTO "Tokens"(value,scope,"userId","createdAt","updatedAt") VALUES
 ('${TOKEN}',ARRAY['*']::varchar[],'${USER_ID}',now(),now());
COMMIT;
`

const CLEANUP_SQL = `
DELETE FROM "Tokens" WHERE value = '${TOKEN}';
DELETE FROM "Users" WHERE id = '${USER_ID}';
`

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

const client = Axios.create({
  baseURL: BASE,
  timeout: 5000,
  validateStatus: () => true,
  headers: { authorization: `Bearer ${TOKEN}` },
})

beforeAll(() => {
  runSql(CLEANUP_SQL)
  runSql(SEED_SQL)
})

afterAll(() => {
  runSql(CLEANUP_SQL)
})

describe('GET /rescues/me', () => {
  it('returns an empty list for a user without rats', async () => {
    const response = await client.get('/rescues/me')
    expect(response.status).toBe(200)
    expect(response.data.data ?? []).toEqual([])
  })

  it('returns an empty list when filtering by first limpet for a user without rats', async () => {
    const filter = JSON.stringify({ status: { eq: 'closed' }, outcome: { is: null } })
    const response = await client.get('/rescues/me', { params: { filter, _firstLimpet: 'me' } })
    expect(response.status).toBe(200)
    expect(response.data.data ?? []).toEqual([])
  })
})
