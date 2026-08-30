/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const { execSync } = require('child_process')

// Integration test for the groupsync endpoint against the docker-compose mirror.
// Seeds a dedicated, disposable group/user/token set directly in the db container
// (no real group is touched, no Anope write path is triggered) and tears it down after.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'
const READ_TOKEN = 'gs_test_anope_read_token'
const WRONG_SCOPE_TOKEN = 'gs_test_wrong_scope_token'

const MAIN_EMAIL = 'groupsync-main@fuelrats.test'
const NOACCESS_EMAIL = 'groupsync-noaccess@fuelrats.test'
const UNKNOWN_EMAIL = 'groupsync-nobody@fuelrats.test'

const GROUP_IDS = [
  'aaaa0000-0000-4000-8000-000000000001',
  'aaaa0000-0000-4000-8000-000000000002',
  'aaaa0000-0000-4000-8000-000000000003',
]
const USER_IDS = [
  'bbbb0000-0000-4000-8000-000000000001',
  'bbbb0000-0000-4000-8000-000000000002',
]

const SEED_SQL = `
BEGIN;
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt") VALUES
 ('${GROUP_IDS[0]}','gstesta','GroupSync Test A',50,'{"fuelrats":"HV","dnd":"V"}',ARRAY['anope.read']::varchar[],now(),now()),
 ('${GROUP_IDS[1]}','gstestb',NULL,20,'{"fuelrats":"V","snickers":"HV"}',ARRAY[]::varchar[],now(),now()),
 ('${GROUP_IDS[2]}','gstestempty','GroupSync Empty',10,'{}',ARRAY[]::varchar[],now(),now());
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_IDS[0]}','${MAIN_EMAIL}','disabled','active',now(),now()),
 ('${USER_IDS[1]}','${NOACCESS_EMAIL}','disabled','active',now(),now());
INSERT INTO "UserGroups"("userId","groupId") VALUES
 ('${USER_IDS[0]}','${GROUP_IDS[0]}'),
 ('${USER_IDS[0]}','${GROUP_IDS[1]}'),
 ('${USER_IDS[1]}','${GROUP_IDS[2]}');
INSERT INTO "Tokens"(value,scope,"userId","createdAt","updatedAt") VALUES
 ('${READ_TOKEN}',ARRAY['anope.read']::varchar[],'${USER_IDS[0]}',now(),now()),
 ('${WRONG_SCOPE_TOKEN}',ARRAY['groups.read']::varchar[],'${USER_IDS[0]}',now(),now());
COMMIT;
`

const CLEANUP_SQL = `
DELETE FROM "Tokens" WHERE value IN ('${READ_TOKEN}','${WRONG_SCOPE_TOKEN}');
DELETE FROM "UserGroups" WHERE "userId" IN ('${USER_IDS[0]}','${USER_IDS[1]}');
DELETE FROM "Users" WHERE id IN ('${USER_IDS[0]}','${USER_IDS[1]}');
DELETE FROM "Groups" WHERE id IN ('${GROUP_IDS[0]}','${GROUP_IDS[1]}','${GROUP_IDS[2]}');
`

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

const client = (token) => {
  return Axios.create({
    baseURL: BASE,
    timeout: 5000,
    validateStatus: () => true,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

const sortLetters = (value) => value.split('').sort().join('')

beforeAll(() => {
  runSql(CLEANUP_SQL)
  runSql(SEED_SQL)
})

afterAll(() => {
  runSql(CLEANUP_SQL)
})

describe('GET /anope', () => {
  it('merges channel flags across a user\'s groups (union of letters, #-prefixed)', async () => {
    const response = await client(READ_TOKEN).get('/anope', { params: { email: MAIN_EMAIL } })
    expect(response.status).toBe(200)

    const { channels, roles } = response.data
    expect(sortLetters(channels['#fuelrats'])).toBe('HV')
    expect(channels['#dnd']).toBe('V')
    expect(sortLetters(channels['#snickers'])).toBe('HV')

    // roles carry the group name (SWHOIS tag) and a display (whois text)
    // phrased as a "<nick> …" completion, display falling back to the group
    // name when unset
    const roleByName = new Map(roles.map((role) => [role.name, role.display]))
    expect(roleByName.get('gstesta')).toBe('is a GroupSync Test A')
    expect(roleByName.get('gstestb')).toBe('is a gstestb')
  })

  it('returns explicit empty channels for a user with groups but no channel access', async () => {
    const response = await client(READ_TOKEN).get('/anope', { params: { email: NOACCESS_EMAIL } })
    expect(response.status).toBe(200)
    expect(response.data.channels).toEqual({})
    expect(response.data.roles.map((role) => role.display)).toContain('is a GroupSync Empty')
  })

  it('returns 404 for an unknown user', async () => {
    const response = await client(READ_TOKEN).get('/anope', { params: { email: UNKNOWN_EMAIL } })
    expect(response.status).toBe(404)
  })

  it('returns 400 for a malformed email', async () => {
    const response = await client(READ_TOKEN).get('/anope', { params: { email: 'not-an-email' } })
    expect(response.status).toBe(400)
  })

  it('returns 400 when email is missing', async () => {
    const response = await client(READ_TOKEN).get('/anope')
    expect(response.status).toBe(400)
  })

  it('returns 403 for a token without the anope.read scope', async () => {
    const response = await client(WRONG_SCOPE_TOKEN).get('/anope', { params: { email: MAIN_EMAIL } })
    expect(response.status).toBe(403)
  })

  it('returns 401 without a bearer token', async () => {
    const response = await client(null).get('/anope', { params: { email: MAIN_EMAIL } })
    expect(response.status).toBe(401)
  })
})

describe('POST /anope/bulk', () => {
  it('returns per-email views keyed by the requested email, omitting unknowns', async () => {
    const response = await client(READ_TOKEN).post('/anope/bulk', {
      emails: [MAIN_EMAIL, NOACCESS_EMAIL, UNKNOWN_EMAIL],
    })
    expect(response.status).toBe(200)

    expect(response.data[UNKNOWN_EMAIL]).toBeUndefined()
    expect(sortLetters(response.data[MAIN_EMAIL].channels['#fuelrats'])).toBe('HV')
    expect(response.data[NOACCESS_EMAIL].channels).toEqual({})
  })

  it('returns 400 for an empty or non-array emails field', async () => {
    const response = await client(READ_TOKEN).post('/anope/bulk', { emails: [] })
    expect(response.status).toBe(400)
  })

  it('returns 400 when over the size cap', async () => {
    const emails = Array.from({ length: 201 }, (unused, index) => `bulk-${index}@fuelrats.test`)
    const response = await client(READ_TOKEN).post('/anope/bulk', { emails })
    expect(response.status).toBe(400)
  })
})
