/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const crypto = require('crypto')
const { execSync } = require('child_process')
const localisations = require('../../localisations.json')

// Integration test for POST /irc/sasl-token against the docker-compose mirror, whose API must have
// FRAPI_IRC_TOKEN_SECRET set (the unset case is irc-sasl-token-unconfigured.test.js). Anope is read-only
// here: the two fixture accounts are looked up at runtime among the Anope accounts with a
// `@fuelrats.test` email, and only Postgres rows (users, tokens, clients) are seeded and torn down.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'
const API_CONTAINER = process.env.FRAPI_TEST_API_CONTAINER ?? 'apifuelratscom-api-1'

const USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000a1'
const UNREGISTERED_USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000a2'
// Holds the second fixture account's email but has not verified it
const UNVERIFIED_USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000a3'
// Holds users.write, so the request middleware lets it represent other users
const REPRESENTING_USER_ID = 'e3e3e3e3-0000-4000-8000-0000000000a4'
const USER_IDS = [USER_ID, UNREGISTERED_USER_ID, UNVERIFIED_USER_ID, REPRESENTING_USER_ID]
const UNREGISTERED_EMAIL = 'sasl-token-unregistered@fuelrats.test'

// The `verified` group exists on a real database; the mirror's schema-only database gets one with this id,
// which is the only group id cleanup deletes besides the representing caller's
const VERIFIED_GROUP_ID = 'e3e3e3e3-0000-4000-8000-0000000000f1'
const REPRESENTING_GROUP_ID = 'e3e3e3e3-0000-4000-8000-0000000000f2'
const GROUP_IDS = [VERIFIED_GROUP_ID, REPRESENTING_GROUP_ID]

const WEBSITE_CLIENT_ID = 'e3e3e3e3-0000-4000-8000-0000000000c1'
const PUBLIC_CLIENT_ID = 'e3e3e3e3-0000-4000-8000-0000000000c2'
// A confidential OpenID Connect relying party, which receives an ID token for the user
const RELYING_PARTY_CLIENT_ID = 'e3e3e3e3-0000-4000-8000-0000000000c3'
const CLIENT_IDS = [WEBSITE_CLIENT_ID, PUBLIC_CLIENT_ID, RELYING_PARTY_CLIENT_ID]
const PUBLIC_REDIRECT = 'http://localhost:8099/static/fuelrats-rat/callback.html'
const RELYING_PARTY_REDIRECT = 'https://wiki.fuelrats.test/oidc/callback'
const RELYING_PARTY_SECRET = 'Vm3kQ8wZr5tN1bX7cL2pH9sJ4fD6gY0a' // gitleaks:allow (test fixture)
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'

const FULL_SCOPE_TOKEN = 'irctestfullscopetoken00000000001'
const NO_IRC_SCOPE_TOKEN = 'irctestratsreadmetoken0000000001'
const UNREGISTERED_TOKEN = 'irctestunregisteredtoken00000001'
const UNVERIFIED_TOKEN = 'irctestunverifiedtoken0000000001'
const REPRESENTING_TOKEN = 'irctestrepresentingtoken00000001'

const TOKEN_LIFETIME_SECONDS = 60
const CLOCK_TOLERANCE_SECONDS = 5
const tokenPattern = /^frk1:(\d+):([0-9a-f]{64})$/u

const cleanupSql = `
DELETE FROM "Codes" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "Tokens" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "UserGroups" WHERE "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "Clients" WHERE id IN ('${CLIENT_IDS.join("','")}');
DELETE FROM "Users" WHERE id IN ('${USER_IDS.join("','")}');
DELETE FROM "Groups" WHERE id IN ('${GROUP_IDS.join("','")}');
`

const seedSql = ({ email, unverifiedEmail, relyingPartySecretHash }) => {
  return `
BEGIN;
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_ID}','${email}','disabled','active',now(),now()),
 ('${UNREGISTERED_USER_ID}','${UNREGISTERED_EMAIL}','disabled','active',now(),now()),
 ('${UNVERIFIED_USER_ID}','${unverifiedEmail}','disabled','active',now(),now()),
 ('${REPRESENTING_USER_ID}','sasl-token-representing@fuelrats.test','disabled','active',now(),now());
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt")
 SELECT '${VERIFIED_GROUP_ID}','verified','Verified',0,'{}',ARRAY[]::varchar[],now(),now()
 WHERE NOT EXISTS (SELECT 1 FROM "Groups" WHERE name = 'verified');
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt") VALUES
 ('${REPRESENTING_GROUP_ID}','sasltokenrepresenting','SASL Token Test Representing',10,'{}',ARRAY['users.write']::varchar[],now(),now());
INSERT INTO "UserGroups"(id,"userId","groupId","createdAt","updatedAt")
 SELECT gen_random_uuid(), member.id, verified.id, now(), now()
 FROM (VALUES ('${USER_ID}'::uuid), ('${UNREGISTERED_USER_ID}'::uuid), ('${REPRESENTING_USER_ID}'::uuid)) AS member(id)
 CROSS JOIN (SELECT id FROM "Groups" WHERE name = 'verified') AS verified;
INSERT INTO "UserGroups"(id,"userId","groupId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${REPRESENTING_USER_ID}','${REPRESENTING_GROUP_ID}',now(),now());
INSERT INTO "Clients"(id,name,secret,"redirectUri","userId","firstParty","public","createdAt","updatedAt") VALUES
 ('${WEBSITE_CLIENT_ID}','SASL Token Test Website','${SEED_SECRET}',NULL,'${USER_ID}',true,false,now(),now()),
 ('${PUBLIC_CLIENT_ID}','SASL Token Test Kiwi','${SEED_SECRET}','${PUBLIC_REDIRECT}','${USER_ID}',false,true,now(),now()),
 ('${RELYING_PARTY_CLIENT_ID}','SASL Token Test Wiki','${relyingPartySecretHash}','${RELYING_PARTY_REDIRECT}','${USER_ID}',false,false,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${FULL_SCOPE_TOKEN}',ARRAY['*']::varchar[],'${USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${NO_IRC_SCOPE_TOKEN}',ARRAY['rats.read.me']::varchar[],'${USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${UNREGISTERED_TOKEN}',ARRAY['*']::varchar[],'${UNREGISTERED_USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${UNVERIFIED_TOKEN}',ARRAY['*']::varchar[],'${UNVERIFIED_USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${REPRESENTING_TOKEN}',ARRAY['*']::varchar[],'${REPRESENTING_USER_ID}','${WEBSITE_CLIENT_ID}',now(),now());
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

/* Runs authorize, and consent when it is shown, with the seeded user's website token and returns the code */
const websiteAuthorizeCode = async (params) => {
  const websiteAuth = { authorization: `Bearer ${FULL_SCOPE_TOKEN}` }

  const authorizeResponse = await api.get('/oauth2/authorize', {
    params: {
      response_type: 'code',
      state: crypto.randomBytes(8).toString('hex'),
      ...params,
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
  return code
}

/* Runs the public client's authorize, consent and PKCE exchange for the seeded user and returns the bearer */
const publicClientToken = async (scope) => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  const code = await websiteAuthorizeCode({
    client_id: PUBLIC_CLIENT_ID,
    redirect_uri: PUBLIC_REDIRECT,
    scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

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

/* Runs an OpenID Connect login of the seeded user at the relying party and returns its token response */
const relyingPartyTokens = async () => {
  const code = await websiteAuthorizeCode({
    client_id: RELYING_PARTY_CLIENT_ID,
    redirect_uri: RELYING_PARTY_REDIRECT,
    scope: 'openid profile',
  })

  const basic = Buffer.from(`${RELYING_PARTY_CLIENT_ID}:${RELYING_PARTY_SECRET}`).toString('base64')
  const exchange = await api.post('/oauth2/token', new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: RELYING_PARTY_REDIRECT,
  }).toString(), { headers: { 'content-type': 'application/x-www-form-urlencoded', 'authorization': `Basic ${basic}` } })
  expect(exchange.status).toBe(200)
  return exchange.data
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

beforeAll(async () => {
  const { accounts, unregisteredHasAccount } = findAnopeFixtures()
  expect(accounts.length).toBe(2)
  expect(unregisteredHasAccount).toBe(false)
  ;[ownAccount, otherAccount] = accounts

  const relyingPartySecretHash = await Bun.password.hash(RELYING_PARTY_SECRET, { algorithm: 'bcrypt', cost: 12 })
  runSql(cleanupSql)
  runSql(seedSql({ email: ownAccount.email, unverifiedEmail: otherAccount.email, relyingPartySecretHash }))
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
    expect(error.detail).toBe(localisations.en.translation.bad_request.detail)
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

  it('refuses a user whose email is not verified, although an Anope account has that email', async () => {
    const response = await saslToken(UNVERIFIED_TOKEN, {})
    expect(response.status).toBe(400)
    expect(response.data.password).toBeUndefined()
    const [error] = response.data.errors
    expect(error.status).toBe('bad_request')
    expect(error.detail).toContain('Verify the email address')
    expect(error.source).toEqual({ pointer: '/email' })
    expect(error.links.about.endsWith('/profile/overview')).toBe(true)
  })

  it('refuses an OpenID Connect ID token with the 401 of an invalid token', async () => {
    const tokens = await relyingPartyTokens()
    expect(tokens.id_token).toBeTruthy()

    const invalid = await saslToken('irctestnotatoken0000000000000001', {})
    expect(invalid.status).toBe(401)
    const response = await saslToken(tokens.id_token, {})
    expect(response.status).toBe(401)
    expect(response.data.password).toBeUndefined()
    expect(response.data.errors[0].status).toBe(invalid.data.errors[0].status)
    expect(response.data.errors[0].detail).toBe(invalid.data.errors[0].detail)

    /* The access token of the same login authenticates, and its scope lacks irc.login */
    const access = await saslToken(tokens.access_token, {})
    expect(access.status).toBe(403)
  })

  it('refuses a request that represents another user', async () => {
    const response = await api.post('/irc/sasl-token', {}, {
      headers: { 'authorization': `Bearer ${REPRESENTING_TOKEN}`, 'x-representing': USER_ID },
    })
    expect(response.status).toBe(403)
    expect(response.data.password).toBeUndefined()
    expect(response.data.errors[0].source).toEqual({ parameter: 'x-representing' })
  })
})

describe('OAuth authorize with an irc.login public client token', () => {
  const authorizeParams = (scope) => {
    const challenge = crypto.createHash('sha256').update(crypto.randomBytes(32).toString('base64url')).digest('base64url')
    return {
      response_type: 'code',
      client_id: PUBLIC_CLIENT_ID,
      redirect_uri: PUBLIC_REDIRECT,
      scope,
      state: crypto.randomBytes(8).toString('hex'),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }
  }

  it('cannot authorize the client again or approve a wider scope for itself', async () => {
    const bearer = await publicClientToken('irc.login')
    const headers = { authorization: `Bearer ${bearer}` }

    for (const scope of ['irc.login', 'users.read.me']) {
      const response = await api.get('/oauth2/authorize', { params: authorizeParams(scope), headers })
      expect(response.status).toBe(403)
      expect(response.data.redirect).toBeUndefined()
      expect(response.data.transactionId).toBeUndefined()
    }

    const websiteAuthorize = await api.get('/oauth2/authorize', {
      params: authorizeParams('users.read.me'),
      headers: { authorization: `Bearer ${FULL_SCOPE_TOKEN}` },
    })
    expect(websiteAuthorize.data.transactionId).toBeTruthy()
    const cookie = (websiteAuthorize.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')
    const decision = await api.post('/oauth2/authorize', {
      transactionId: websiteAuthorize.data.transactionId,
      allow: true,
    }, { headers: { ...headers, cookie } })
    expect(decision.status).toBe(403)
    expect(decision.data.redirect).toBeUndefined()
  })
})
