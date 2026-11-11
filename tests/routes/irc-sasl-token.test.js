/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const crypto = require('crypto')
const { execSync } = require('child_process')

// Integration test for POST /irc/sasl-token against the docker-compose mirror, whose API must have
// FRAPI_IRC_TOKEN_SECRET set (the unset case is irc-sasl-token-unconfigured.test.js). Anope is read-only
// here: the two fixture accounts are looked up at runtime among the Anope accounts with a
// `@fuelrats.test` email, and only Postgres rows (users, tokens, clients) are seeded and torn down.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'
const API_CONTAINER = process.env.FRAPI_TEST_API_CONTAINER ?? 'apifuelratscom-api-1'

const USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000a1'
const UNREGISTERED_USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000a2'
const USER_IDS = [USER_ID, UNREGISTERED_USER_ID]
const UNREGISTERED_EMAIL = 'sasl-token-unregistered@fuelrats.test'

const WEBSITE_CLIENT_ID = 'e3e3e3e3-0000-4000-8000-0000000000c1'
const PUBLIC_CLIENT_ID = 'e3e3e3e3-0000-4000-8000-0000000000c2'
const CLIENT_IDS = [WEBSITE_CLIENT_ID, PUBLIC_CLIENT_ID]
const PUBLIC_REDIRECT = 'http://localhost:8099/static/fuelrats-rat/callback.html'
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'

const FULL_SCOPE_TOKEN = 'irctestfullscopetoken00000000001'
const NO_IRC_SCOPE_TOKEN = 'irctestratsreadmetoken0000000001'
const UNREGISTERED_TOKEN = 'irctestunregisteredtoken00000001'

const TOKEN_LIFETIME_SECONDS = 60
const CLOCK_TOLERANCE_SECONDS = 5
const tokenPattern = /^frk1:(\d+):([0-9a-f]{64})$/u

const cleanupSql = `
DELETE FROM "Codes" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "Tokens" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "Clients" WHERE id IN ('${CLIENT_IDS.join("','")}');
DELETE FROM "Users" WHERE id IN ('${USER_IDS.join("','")}');
`

const seedSql = (email) => {
  return `
BEGIN;
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_ID}','${email}','disabled','active',now(),now()),
 ('${UNREGISTERED_USER_ID}','${UNREGISTERED_EMAIL}','disabled','active',now(),now());
INSERT INTO "Clients"(id,name,secret,"redirectUri","userId","firstParty","public","createdAt","updatedAt") VALUES
 ('${WEBSITE_CLIENT_ID}','SASL Token Test Website','${SEED_SECRET}',NULL,'${USER_ID}',true,false,now(),now()),
 ('${PUBLIC_CLIENT_ID}','SASL Token Test Kiwi','${SEED_SECRET}','${PUBLIC_REDIRECT}','${USER_ID}',false,true,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${FULL_SCOPE_TOKEN}',ARRAY['*']::varchar[],'${USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${NO_IRC_SCOPE_TOKEN}',ARRAY['rats.read.me']::varchar[],'${USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${UNREGISTERED_TOKEN}',ARRAY['*']::varchar[],'${UNREGISTERED_USER_ID}','${WEBSITE_CLIENT_ID}',now(),now());
COMMIT;
`
}

const runSql = (sql) => {
  execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q`, {
    input: sql,
    stdio: ['pipe', 'ignore', 'inherit'],
  })
}

/* Runs a script in the API container, where the Anope connection config lives, and returns its marked JSON line */
const runInApi = (script) => {
  const output = execSync(`docker exec -i ${API_CONTAINER} sh -c 'cat > /tmp/irc-sasl-token-test.mjs && cd /app && bun /tmp/irc-sasl-token-test.mjs'`, {
    input: script,
    stdio: ['pipe', 'pipe', 'ignore'],
  }).toString()
  const line = output.split('\n').find((entry) => entry.startsWith('RESULT '))
  return JSON.parse(line.slice('RESULT '.length))
}

/* Two Anope accounts with a `@fuelrats.test` email whose display nick is an alias of the account */
const findAnopeFixtures = () => {
  return runInApi(`
const { default: knex } = await import('/app/node_modules/knex/knex.js')
const { default: config } = await import('/app/src/config.mjs')
const { database, username, hostname, port, password, tablePrefix } = config.anope
const mysql = knex({ client: 'mysql2', connection: { host: hostname, port, user: username, database, password, supportBigNumbers: true, bigNumberStrings: true } })
const core = tablePrefix + 'NickCore'
const alias = tablePrefix + 'NickAlias'
const accounts = await mysql(core).select('email', 'display')
  .where('email', 'like', '%@fuelrats.test')
  .whereExists(mysql(alias).select(1).whereRaw('?? = ??', [alias + '.ncid', core + '.uniqueid']).whereRaw('?? = ??', [alias + '.nick', core + '.display']))
  .orderBy('email')
  .limit(2)
const unregistered = await mysql(core).whereRaw('lower(email) = lower(?)', [${JSON.stringify(UNREGISTERED_EMAIL)}]).first('display')
await mysql.destroy()
console.log('RESULT ' + JSON.stringify({ accounts, unregisteredHasAccount: Boolean(unregistered) }))
process.exit(0)
`)
}

/* The secret the API under test mints with, read into memory only */
const readTokenSecret = () => {
  return execSync(`docker exec ${API_CONTAINER} sh -c 'printenv FRAPI_IRC_TOKEN_SECRET || cat /run/secrets/frapi_irc_token_secret'`, {
    stdio: ['ignore', 'pipe', 'ignore'],
  }).toString().trim()
}

const api = Axios.create({
  baseURL: BASE,
  timeout: 10000,
  maxRedirects: 0,
  validateStatus: () => true,
})

const saslToken = (bearer, body) => {
  const headers = bearer ? { authorization: `Bearer ${bearer}` } : {}
  return api.post('/irc/sasl-token', body, { headers })
}

/* Runs the public client's authorize, consent and PKCE exchange for the seeded user and returns the bearer */
const publicClientToken = async (scope) => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const websiteAuth = { authorization: `Bearer ${FULL_SCOPE_TOKEN}` }

  const authorizeResponse = await api.get('/oauth2/authorize', {
    params: {
      response_type: 'code',
      client_id: PUBLIC_CLIENT_ID,
      redirect_uri: PUBLIC_REDIRECT,
      scope,
      state: crypto.randomBytes(8).toString('hex'),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    },
    headers: websiteAuth,
  })
  expect(authorizeResponse.status).toBe(200)

  let { redirect } = authorizeResponse.data
  if (!redirect) {
    const cookie = (authorizeResponse.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')
    const decision = await api.post('/oauth2/authorize', {
      transactionId: authorizeResponse.data.transactionId,
      allow: true,
    }, { headers: { ...websiteAuth, cookie } })
    expect(decision.status).toBe(200)
    redirect = decision.data.redirect
  }
  const code = new URL(redirect).searchParams.get('code')
  expect(code).toBeTruthy()

  const exchange = await api.post('/oauth2/token', new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: PUBLIC_CLIENT_ID,
    code,
    redirect_uri: PUBLIC_REDIRECT,
    code_verifier: verifier,
  }).toString(), { headers: { 'content-type': 'application/x-www-form-urlencoded' } })
  expect(exchange.status).toBe(200)
  return exchange.data.access_token
}

/* Asserts a successful response for `account` and that its password verifies under the API's secret */
const expectValidToken = (response, account) => {
  expect(response.status).toBe(200)
  // A plain JSON body, not a JSON:API document
  expect(response.headers['content-type']).toStartWith('application/json')
  expect(Object.keys(response.data).sort()).toEqual(['account', 'expiresIn', 'password'])
  expect(response.data.account).toBe(account)
  expect(response.data.expiresIn).toBe(TOKEN_LIFETIME_SECONDS)

  const match = tokenPattern.exec(response.data.password)
  expect(match).not.toBeNull()
  const [, tsText, mac] = match
  expect(Math.abs(Number(tsText) - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(CLOCK_TOLERANCE_SECONDS)

  const expected = crypto.createHmac('sha256', readTokenSecret()).update(`${account}|${tsText}`).digest('hex')
  expect(mac).toBe(expected)
}

let ownAccount
let otherAccount

beforeAll(() => {
  const { accounts, unregisteredHasAccount } = findAnopeFixtures()
  expect(accounts.length).toBe(2)
  expect(unregisteredHasAccount).toBe(false)
  ;[ownAccount, otherAccount] = accounts

  runSql(cleanupSql)
  runSql(seedSql(ownAccount.email))
})

afterAll(() => {
  runSql(cleanupSql)
})

describe('POST /irc/sasl-token', () => {
  it('returns 401 without a bearer token', async () => {
    const response = await saslToken(null, {})
    expect(response.status).toBe(401)
  })

  it('refuses a token whose scope lacks irc.login', async () => {
    const response = await saslToken(NO_IRC_SCOPE_TOKEN, {})
    expect(response.status).toBe(403)
  })

  it('refuses a user without an Anope account and links to the profile page', async () => {
    const response = await saslToken(UNREGISTERED_TOKEN, {})
    expect(response.status).toBe(400)
    const [error] = response.data.errors
    expect(error.status).toBe('bad_request')
    expect(error.source).toEqual({})
    expect(error.links.about.endsWith('/profile/overview')).toBe(true)
  })

  it('mints a token for the account\'s display nick with scope *', async () => {
    const response = await saslToken(FULL_SCOPE_TOKEN, {})
    expectValidToken(response, ownAccount.display)
  })

  it('returns the alias as registered when the nick is requested in another case', async () => {
    const { display } = ownAccount
    const requested = display.toLowerCase() === display ? display.toUpperCase() : display.toLowerCase()
    const response = await saslToken(FULL_SCOPE_TOKEN, { nick: requested })
    expectValidToken(response, display)
  })

  it('refuses another account\'s alias and an unregistered nick alike', async () => {
    const other = await saslToken(FULL_SCOPE_TOKEN, { nick: otherAccount.display })
    expect(other.status).toBe(400)
    expect(other.data.errors[0].source).toEqual({ pointer: '/nick' })
    expect(other.data.account).toBeUndefined()

    const unregistered = await saslToken(FULL_SCOPE_TOKEN, { nick: `${ownAccount.display}_Jameson` })
    expect(unregistered.status).toBe(400)
    expect(unregistered.data.errors[0].source).toEqual({ pointer: '/nick' })
  })

  it('rejects a nick that is not a nickname string', async () => {
    const bodies = [{ nick: { ne: '' } }, { nick: [ownAccount.display] }, { nick: 42 }, { nick: '' }, { nick: 'Jameson Rat' }]
    for (const body of bodies) {
      const response = await saslToken(FULL_SCOPE_TOKEN, body)
      expect(response.status).toBe(400)
      expect(response.data.errors[0].source).toEqual({ pointer: '/nick' })
    }
  })

  it('mints a token for a public client token scoped irc.login', async () => {
    const bearer = await publicClientToken('irc.login')
    const response = await saslToken(bearer, { nick: ownAccount.display })
    expectValidToken(response, ownAccount.display)
  })

  it('refuses a public client token scoped without irc.login', async () => {
    const bearer = await publicClientToken('rats.read.me')
    const response = await saslToken(bearer, {})
    expect(response.status).toBe(403)
  })
})
