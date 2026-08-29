/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const { execSync } = require('child_process')

// Integration test for the atomic group-definition endpoints (groupsync Add-on C)
// against the docker-compose mirror. Seeds a disposable admin user + token and a
// target group, exercises the channel/permission endpoints directly and via the
// `x-representing` on-behalf-of path the IRC bot uses, then tears everything down.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'

const ADMIN_TOKEN = 'gs_test_admin_rw_token'
const READ_TOKEN = 'gs_test_groups_read_token'

const ADMIN_GROUP_ID = 'cccc0000-0000-4000-8000-000000000001'
const TARGET_GROUP_ID = 'cccc0000-0000-4000-8000-000000000002'
const ADMIN_USER_ID = 'dddd0000-0000-4000-8000-000000000001'
const PLAIN_USER_ID = 'dddd0000-0000-4000-8000-000000000002'

const SEED_SQL = `
BEGIN;
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt") VALUES
 ('${ADMIN_GROUP_ID}','gscmgmttestadmin','GroupSync Admin',100,'{}',ARRAY['groups.read','groups.write','users.write']::varchar[],now(),now()),
 ('${TARGET_GROUP_ID}','gscmgmttesttarget','GroupSync Target',10,'{}',ARRAY[]::varchar[],now(),now());
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${ADMIN_USER_ID}','groupsync-admin@fuelrats.test','disabled','active',now(),now()),
 ('${PLAIN_USER_ID}','groupsync-plain@fuelrats.test','disabled','active',now(),now());
INSERT INTO "UserGroups"("userId","groupId") VALUES
 ('${ADMIN_USER_ID}','${ADMIN_GROUP_ID}'),
 ('${PLAIN_USER_ID}','${TARGET_GROUP_ID}');
INSERT INTO "Tokens"(value,scope,"userId","createdAt","updatedAt") VALUES
 ('${ADMIN_TOKEN}',ARRAY['*']::varchar[],'${ADMIN_USER_ID}',now(),now()),
 ('${READ_TOKEN}',ARRAY['groups.read']::varchar[],'${ADMIN_USER_ID}',now(),now());
COMMIT;
`

const CLEANUP_SQL = `
DELETE FROM "Tokens" WHERE value IN ('${ADMIN_TOKEN}','${READ_TOKEN}');
DELETE FROM "UserGroups" WHERE "userId" IN ('${ADMIN_USER_ID}','${PLAIN_USER_ID}');
DELETE FROM "Users" WHERE id IN ('${ADMIN_USER_ID}','${PLAIN_USER_ID}');
DELETE FROM "Groups" WHERE id IN ('${ADMIN_GROUP_ID}','${TARGET_GROUP_ID}');
`

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

const client = (token, representing) => {
  const headers = {}
  if (token) {
    headers.authorization = `Bearer ${token}`
  }
  if (representing) {
    headers['x-representing'] = representing
  }
  return Axios.create({ baseURL: BASE, timeout: 5000, validateStatus: () => true, headers })
}

const sortLetters = (value) => value.split('').sort().join('')
const attrs = (response) => response.data.data.attributes

beforeAll(() => {
  runSql(CLEANUP_SQL)
  runSql(SEED_SQL)
})

afterAll(() => {
  runSql(CLEANUP_SQL)
})

describe('PUT/DELETE /groups/:id/channels/:channel', () => {
  it('sets a channel\'s flags and echoes the updated group', async () => {
    const response = await client(ADMIN_TOKEN).put(`/groups/${TARGET_GROUP_ID}/channels/ops`, {
      data: { attributes: { flags: 'OV' } },
    })
    expect(response.status).toBe(200)
    expect(sortLetters(attrs(response).channels.ops)).toBe('OV')
  })

  it('rejects an invalid flag letter with 400', async () => {
    const response = await client(ADMIN_TOKEN).put(`/groups/${TARGET_GROUP_ID}/channels/ops`, {
      data: { attributes: { flags: 'Zg' } },
    })
    expect(response.status).toBe(400)
  })

  it('removes a channel (idempotently)', async () => {
    const first = await client(ADMIN_TOKEN).delete(`/groups/${TARGET_GROUP_ID}/channels/ops`)
    expect(first.status).toBe(200)
    expect(attrs(first).channels.ops).toBeUndefined()

    const second = await client(ADMIN_TOKEN).delete(`/groups/${TARGET_GROUP_ID}/channels/ops`)
    expect(second.status).toBe(200)
  })

  it('returns 403 for a token without groups.write', async () => {
    const response = await client(READ_TOKEN).put(`/groups/${TARGET_GROUP_ID}/channels/ops`, {
      data: { attributes: { flags: 'OV' } },
    })
    expect(response.status).toBe(403)
  })
})

describe('PUT/DELETE /groups/:id/permissions/:scope', () => {
  it('grants a scope (idempotently) and echoes the updated group', async () => {
    const first = await client(ADMIN_TOKEN).put(`/groups/${TARGET_GROUP_ID}/permissions/rescues.read`)
    expect(first.status).toBe(200)
    expect(attrs(first).permissions).toContain('rescues.read')

    const second = await client(ADMIN_TOKEN).put(`/groups/${TARGET_GROUP_ID}/permissions/rescues.read`)
    expect(second.status).toBe(200)
    expect(attrs(second).permissions.filter((scope) => scope === 'rescues.read')).toHaveLength(1)
  })

  it('revokes a scope', async () => {
    const response = await client(ADMIN_TOKEN).delete(`/groups/${TARGET_GROUP_ID}/permissions/rescues.read`)
    expect(response.status).toBe(200)
    expect(attrs(response).permissions).not.toContain('rescues.read')
  })

  it('rejects an unknown scope with 400', async () => {
    const response = await client(ADMIN_TOKEN).put(`/groups/${TARGET_GROUP_ID}/permissions/bogus.write`)
    expect(response.status).toBe(400)
  })

  it('returns 403 for a token without groups.write', async () => {
    const response = await client(READ_TOKEN).put(`/groups/${TARGET_GROUP_ID}/permissions/rescues.read`)
    expect(response.status).toBe(403)
  })
})

describe('x-representing (on-behalf-of, the IRC bot path)', () => {
  it('authorises the write against the represented admin user', async () => {
    const response = await client(ADMIN_TOKEN, ADMIN_USER_ID).put(
      `/groups/${TARGET_GROUP_ID}/channels/ops`, { data: { attributes: { flags: 'V' } } })
    expect(response.status).toBe(200)
    expect(attrs(response).channels.ops).toBe('V')
    await client(ADMIN_TOKEN).delete(`/groups/${TARGET_GROUP_ID}/channels/ops`)
  })

  it('blocks the write when representing a user without groups.write', async () => {
    const response = await client(ADMIN_TOKEN, PLAIN_USER_ID).put(
      `/groups/${TARGET_GROUP_ID}/channels/ops`, { data: { attributes: { flags: 'V' } } })
    expect(response.status).toBe(403)
  })
})

describe('POST/DELETE /groups (create + delete)', () => {
  const NEW_NAME = 'gscmgmttestcreated'
  let createdId

  afterAll(() => {
    runSql(`DELETE FROM "Groups" WHERE name = '${NEW_NAME}';`)
  })

  it('creates a group with a server-generated id (no client-supplied id needed)', async () => {
    const response = await client(ADMIN_TOKEN).post('/groups', {
      data: { type: 'groups', attributes: { name: NEW_NAME } },
    })
    expect(response.status).toBe(201)
    expect(attrs(response).name).toBe(NEW_NAME)
    expect(response.data.data.id).toMatch(/^[0-9a-f-]{36}$/u)
    createdId = response.data.data.id
  })

  it('rejects a duplicate name with 409', async () => {
    const response = await client(ADMIN_TOKEN).post('/groups', {
      data: { type: 'groups', attributes: { name: NEW_NAME } },
    })
    expect(response.status).toBe(409)
  })

  it('deletes the created group', async () => {
    expect(createdId).toBeDefined()
    const response = await client(ADMIN_TOKEN).delete(`/groups/${createdId}`)
    expect(response.status).toBe(204)
  })
})
