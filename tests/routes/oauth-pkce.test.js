/* global describe, it, expect, beforeAll, afterAll */
'use strict'

const Axios = require('axios')
const crypto = require('crypto')
const { execSync } = require('child_process')

// Integration test for OAuth public clients (PKCE, expiring tokens) against the docker-compose mirror.
// Seeds a disposable user, a website session token, one public and one confidential client directly in
// the db container, and tears them down after. The public client stands in for the rat Kiwi client.
const BASE = process.env.FRAPI_TEST_URL ?? 'http://localhost:8080'
const DB_CONTAINER = process.env.FRAPI_TEST_DB_CONTAINER ?? 'apifuelratscom-db-1'
const API_CONTAINER = process.env.FRAPI_TEST_API_CONTAINER ?? 'apifuelratscom-api-1'

const USER_ID = 'd2d2d2d2-0000-4000-8000-0000000000a1'
const USER_EMAIL = 'pkce-test-rat@fuelrats.test'
// Holds users.write, so the request middleware lets it represent the user
const REPRESENTING_USER_ID = 'd2d2d2d2-0000-4000-8000-0000000000a2'
const REPRESENTING_GROUP_ID = 'd2d2d2d2-0000-4000-8000-0000000000b1'
const USER_IDS = [USER_ID, REPRESENTING_USER_ID]

const WEBSITE_CLIENT_ID = 'd2d2d2d2-0000-4000-8000-0000000000c1'
const PUBLIC_CLIENT_ID = 'd2d2d2d2-0000-4000-8000-0000000000c2'
const CONFIDENTIAL_CLIENT_ID = 'd2d2d2d2-0000-4000-8000-0000000000c3'
const CLIENT_IDS = [WEBSITE_CLIENT_ID, PUBLIC_CLIENT_ID, CONFIDENTIAL_CLIENT_ID]

const PUBLIC_REDIRECT = 'http://localhost:8099/static/fuelrats-rat/callback.html'
const CONFIDENTIAL_REDIRECT = 'https://dispatch.fuelrats.test/oauth/callback'
const CONFIDENTIAL_SECRET = 'Rq7mT2vLs9pK4xN8wB3cF6hJ1yD5gZ0e' // gitleaks:allow (test fixture)
// POST /clients generates a secret for public clients too; it is never needed, but is verified if presented
const PUBLIC_SECRET = 'Hn4bW8kPz2cV6mQ1tX9rJ3sL7fG5dA0y' // gitleaks:allow (test fixture)

// Stands in for the bearer the website holds for the signed-in user
const WEBSITE_TOKEN = 'pkcetestwebsitetoken0000000000001'
// A narrow token the user granted the confidential client
const CONFIDENTIAL_NARROW_TOKEN = 'pkcetestconfidentialnarrowtoken01'
// The representing caller's own website token
const REPRESENTING_TOKEN = 'pkcetestrepresentingtoken00000001'
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'
const LEGACY_CODE = 'pkcetestlegacycodewithoutchallenge01'

const SCOPE = 'rats.read.me'
// A scope the user has not granted to any of the clients, so authorize asks for consent
const UNGRANTED_SCOPE = 'users.read.me'
const PUBLIC_LIFETIME_SECONDS = 12 * 60 * 60
const RETENTION_DAYS = 30

const cleanupSql = `
DELETE FROM "Codes" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "Tokens" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "UserGroups" WHERE "userId" IN ('${USER_IDS.join("','")}');
DELETE FROM "Clients" WHERE id IN ('${CLIENT_IDS.join("','")}');
DELETE FROM "Users" WHERE id IN ('${USER_IDS.join("','")}');
DELETE FROM "Groups" WHERE id = '${REPRESENTING_GROUP_ID}';
`

const seedSql = ({ publicSecretHash, confidentialSecretHash }) => {
  return `
BEGIN;
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_ID}','${USER_EMAIL}','disabled','active',now(),now()),
 ('${REPRESENTING_USER_ID}','pkce-test-representing@fuelrats.test','disabled','active',now(),now());
INSERT INTO "Groups"(id,name,"displayName",priority,channels,permissions,"createdAt","updatedAt") VALUES
 ('${REPRESENTING_GROUP_ID}','pkcetestrepresenting','PKCE Test Representing',10,'{}',ARRAY['users.write']::varchar[],now(),now());
INSERT INTO "UserGroups"(id,"userId","groupId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${REPRESENTING_USER_ID}','${REPRESENTING_GROUP_ID}',now(),now());
INSERT INTO "Clients"(id,name,secret,"redirectUri","userId","firstParty","public","createdAt","updatedAt") VALUES
 ('${WEBSITE_CLIENT_ID}','PKCE Test Website','${SEED_SECRET}',NULL,'${USER_ID}',true,false,now(),now()),
 ('${PUBLIC_CLIENT_ID}','PKCE Test Kiwi','${publicSecretHash}','${PUBLIC_REDIRECT}','${USER_ID}',false,true,now(),now()),
 ('${CONFIDENTIAL_CLIENT_ID}','PKCE Test Dispatch','${confidentialSecretHash}','${CONFIDENTIAL_REDIRECT}','${USER_ID}',false,false,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${WEBSITE_TOKEN}',ARRAY['*']::varchar[],'${USER_ID}','${WEBSITE_CLIENT_ID}',now(),now()),
 (gen_random_uuid(),'${CONFIDENTIAL_NARROW_TOKEN}',ARRAY['decals.read.me']::varchar[],'${USER_ID}','${CONFIDENTIAL_CLIENT_ID}',now(),now()),
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

const querySql = (sql) => {
  return execSync(`docker exec -i ${DB_CONTAINER} psql -U fuelrats -d fuelrats -v ON_ERROR_STOP=1 -q -At`, {
    input: sql,
    stdio: ['pipe', 'pipe', 'inherit'],
  }).toString().trim()
}

const api = Axios.create({
  baseURL: BASE,
  timeout: 10000,
  maxRedirects: 0,
  validateStatus: () => true,
})

const pkcePair = () => {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

const authorize = (params, bearer = WEBSITE_TOKEN) => {
  return api.get('/oauth2/authorize', {
    params: { response_type: 'code', state: crypto.randomBytes(8).toString('hex'), ...params },
    headers: { authorization: `Bearer ${bearer}` },
  })
}

const authorizePublic = (params = {}, bearer = WEBSITE_TOKEN) => {
  return authorize({ client_id: PUBLIC_CLIENT_ID, redirect_uri: PUBLIC_REDIRECT, scope: SCOPE, ...params }, bearer)
}

const decide = (authorizeResponse, { allow = true, bearer = WEBSITE_TOKEN } = {}) => {
  const cookie = (authorizeResponse.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')
  return api.post('/oauth2/authorize', { transactionId: authorizeResponse.data.transactionId, allow }, {
    headers: { authorization: `Bearer ${bearer}`, cookie },
  })
}

const tokenRequest = (fields, headers = {}) => {
  return api.post('/oauth2/token', new URLSearchParams(fields).toString(), {
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
  })
}

const redirectParams = (response) => {
  expect(typeof response.data.redirect).toBe('string')
  return new URL(response.data.redirect).searchParams
}

const userinfo = (bearer) => {
  return api.get('/oauth2/userinfo', { headers: { authorization: `Bearer ${bearer}` } })
}

/* A public client authorize that skips consent (a token row for the user and client exists) and returns a code */
const repeatPublicCode = async (challenge) => {
  const response = await authorizePublic({ code_challenge: challenge, code_challenge_method: 'S256' })
  expect(response.status).toBe(200)
  const code = redirectParams(response).get('code')
  expect(code).toBeTruthy()
  return code
}

const exchangePublic = (code, verifier) => {
  const fields = {
    grant_type: 'authorization_code',
    client_id: PUBLIC_CLIENT_ID,
    code,
    redirect_uri: PUBLIC_REDIRECT,
  }
  if (typeof verifier !== 'undefined') {
    fields.code_verifier = verifier
  }
  return tokenRequest(fields)
}

const issuePublicToken = async () => {
  const { verifier, challenge } = pkcePair()
  const code = await repeatPublicCode(challenge)
  const response = await exchangePublic(code, verifier)
  expect(response.status).toBe(200)
  return response.data.access_token
}

/* A full public client login driven by the website token, through the consent screen when it is shown */
const loginPublic = async () => {
  const { verifier, challenge } = pkcePair()
  const authorizeResponse = await authorizePublic({ code_challenge: challenge, code_challenge_method: 'S256' })
  expect(authorizeResponse.status).toBe(200)
  const response = authorizeResponse.data.redirect ? authorizeResponse : await decide(authorizeResponse)
  const code = redirectParams(response).get('code')
  expect(code).toBeTruthy()
  const exchange = await exchangePublic(code, verifier)
  expect(exchange.status).toBe(200)
  return exchange.data.access_token
}

const publicTokenCount = () => {
  return querySql(`SELECT count(*) FROM "Tokens" WHERE "userId" = '${USER_ID}' AND "clientId" = '${PUBLIC_CLIENT_ID}';`)
}

const revokePublic = (token) => {
  return api.post('/oauth2/revoke', new URLSearchParams({ client_id: PUBLIC_CLIENT_ID, token }).toString(), {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  })
}

beforeAll(async () => {
  const hash = (secret) => Bun.password.hash(secret, { algorithm: 'bcrypt', cost: 12 })
  const publicSecretHash = await hash(PUBLIC_SECRET)
  const confidentialSecretHash = await hash(CONFIDENTIAL_SECRET)
  runSql(cleanupSql)
  runSql(seedSql({ publicSecretHash, confidentialSecretHash }))
})

afterAll(() => {
  runSql(cleanupSql)
})

describe('OAuth discovery', () => {
  it('advertises S256 PKCE and the "none" token endpoint auth method', async () => {
    const response = await api.get('/.well-known/openid-configuration')
    expect(response.status).toBe(200)
    expect(response.data.code_challenge_methods_supported).toEqual(['S256'])
    expect(response.data.token_endpoint_auth_methods_supported).toContain('none')
  })
})

describe('public client authorization code flow with PKCE', () => {
  let firstToken

  it('authorizes with consent, then exchanges the code with a valid verifier for an expiring token', async () => {
    const { verifier, challenge } = pkcePair()
    const authorizeResponse = await authorizePublic({ code_challenge: challenge, code_challenge_method: 'S256' })
    expect(authorizeResponse.status).toBe(200)
    expect(authorizeResponse.data.redirect).toBeUndefined()
    expect(authorizeResponse.data.transactionId).toBeTruthy()

    const decision = await decide(authorizeResponse)
    expect(decision.status).toBe(200)
    expect(decision.data.redirect.startsWith(`${PUBLIC_REDIRECT}?`)).toBe(true)
    const code = redirectParams(decision).get('code')

    const response = await exchangePublic(code, verifier)
    expect(response.status).toBe(200)
    expect(response.data.token_type).toBe('bearer')
    expect(response.data.expires_in).toBe(PUBLIC_LIFETIME_SECONDS)
    firstToken = response.data.access_token

    const lifetime = Number(querySql(`SELECT extract(epoch FROM ("expiresAt" - "createdAt")) FROM "Tokens" WHERE value = '${firstToken}';`))
    expect(Math.abs(lifetime - PUBLIC_LIFETIME_SECONDS)).toBeLessThan(5)

    const info = await userinfo(firstToken)
    expect(info.status).toBe(200)
    expect(info.data.sub).toBe(USER_ID)
  })

  it('skips consent on a repeat login and still requires the verifier', async () => {
    const { verifier, challenge } = pkcePair()
    const code = await repeatPublicCode(challenge)
    const challengeStored = querySql(`SELECT "codeChallenge" || ' ' || "codeChallengeMethod" FROM "Codes" WHERE value = '${code}';`)
    expect(challengeStored).toBe(`${challenge} S256`)

    const response = await exchangePublic(code, verifier)
    expect(response.status).toBe(200)
    expect(response.data.access_token).toBeTruthy()
  })

  it('refuses a token exchange without a verifier', async () => {
    const { challenge } = pkcePair()
    const code = await repeatPublicCode(challenge)
    const response = await exchangePublic(code, undefined)
    expect(response.status).toBe(400)
    expect(response.data.error).toBe('invalid_grant')
  })

  it('refuses a token exchange with the wrong verifier and consumes the code', async () => {
    const { verifier, challenge } = pkcePair()
    const code = await repeatPublicCode(challenge)
    const wrong = await exchangePublic(code, pkcePair().verifier)
    expect(wrong.status).toBe(400)
    expect(wrong.data.error).toBe('invalid_grant')

    const retry = await exchangePublic(code, verifier)
    expect(retry.status).toBe(400)
    expect(retry.data.access_token).toBeUndefined()
  })

  it('refuses a public client code that has no stored challenge', async () => {
    runSql(`INSERT INTO "Codes"(id,scope,value,"redirectUri","userId","clientId","createdAt","updatedAt") VALUES
      (gen_random_uuid(),ARRAY['${SCOPE}']::varchar[],'${LEGACY_CODE}','${PUBLIC_REDIRECT}','${USER_ID}','${PUBLIC_CLIENT_ID}',now(),now());`)
    const response = await exchangePublic(LEGACY_CODE, pkcePair().verifier)
    expect(response.status).toBe(400)
    expect(response.data.error).toBe('invalid_grant')
  })

  it('refuses an authorization request without a code challenge', async () => {
    const response = await authorizePublic()
    expect(response.status).toBe(200)
    const params = redirectParams(response)
    expect(params.get('error')).toBe('invalid_request')
    expect(params.get('error_description')).toBe('code_challenge')
    expect(params.get('code')).toBeNull()
  })

  it('refuses the plain code challenge method', async () => {
    const { verifier } = pkcePair()
    const response = await authorizePublic({ code_challenge: verifier, code_challenge_method: 'plain' })
    const params = redirectParams(response)
    expect(params.get('error')).toBe('invalid_request')
    expect(params.get('error_description')).toBe('code_challenge_method')
  })

  it('shows an error instead of redirecting for a redirect_uri other than the registered one', async () => {
    const { challenge } = pkcePair()
    const response = await authorizePublic({
      redirect_uri: 'https://kiwi.fuelrats.test/static/fuelrats-rat/callback.html',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    expect(response.status).toBe(400)
    expect(response.data.redirect).toBeUndefined()
    expect(response.headers.location).toBeUndefined()
    expect(Array.isArray(response.data.errors)).toBe(true)
  })

  it('shows an error instead of redirecting for an unknown or malformed client id', async () => {
    const unknown = await authorize({ client_id: 'd2d2d2d2-0000-4000-8000-0000000000ff', redirect_uri: PUBLIC_REDIRECT, scope: SCOPE })
    expect(unknown.status).toBe(400)
    expect(unknown.data.redirect).toBeUndefined()

    const malformed = await api.get(`/oauth2/authorize?client_id.ne=${PUBLIC_CLIENT_ID}&redirect_uri=${encodeURIComponent(PUBLIC_REDIRECT)}&scope=${SCOPE}&state=abc&response_type=code`, {
      headers: { authorization: `Bearer ${WEBSITE_TOKEN}` },
    })
    expect(malformed.status).toBe(400)
    expect(malformed.data.redirect).toBeUndefined()
  })

  it('refuses OpenID Connect scopes and the wildcard scope', async () => {
    const { challenge } = pkcePair()
    for (const scope of ['openid', 'profile', 'email', 'groups', '*']) {
      const response = await authorizePublic({ scope: `${scope} ${SCOPE}`, code_challenge: challenge, code_challenge_method: 'S256' })
      const params = redirectParams(response)
      expect(params.get('error')).toBe('invalid_scope')
      expect(params.get('error_description')).toBe(scope)
      expect(params.get('code')).toBeNull()
    }
  })

  it('refuses the implicit grant', async () => {
    const { challenge } = pkcePair()
    const response = await authorizePublic({ response_type: 'token', code_challenge: challenge, code_challenge_method: 'S256' })
    const params = redirectParams(response)
    expect(params.get('error')).toBe('unauthorised_client')
    expect(params.get('access_token')).toBeNull()
  })

  it('refuses the password grant', async () => {
    const response = await tokenRequest({
      grant_type: 'password',
      client_id: PUBLIC_CLIENT_ID,
      username: USER_EMAIL,
      password: 'correct horse battery staple',
    })
    expect(response.status).toBe(400)
    expect(response.data.error).toBe('unauthorised_client')
  })

  it('still verifies a secret when one is presented', async () => {
    const { verifier, challenge } = pkcePair()
    const code = await repeatPublicCode(challenge)
    const fields = {
      grant_type: 'authorization_code',
      client_id: PUBLIC_CLIENT_ID,
      code,
      redirect_uri: PUBLIC_REDIRECT,
      code_verifier: verifier,
    }
    const wrongSecret = await tokenRequest({ ...fields, client_secret: CONFIDENTIAL_SECRET })
    expect(wrongSecret.status).toBe(401)

    const rightSecret = await tokenRequest({ ...fields, client_secret: PUBLIC_SECRET })
    expect(rightSecret.status).toBe(200)
  })

  it('rejects an expired token with 401 and keeps its row as the consent record', async () => {
    runSql(`UPDATE "Tokens" SET "expiresAt" = now() - interval '1 minute' WHERE value = '${firstToken}';`)
    const response = await userinfo(firstToken)
    expect(response.status).toBe(401)

    expect(querySql(`SELECT count(*) FROM "Tokens" WHERE value = '${firstToken}';`)).toBe('1')
  })

  it('cannot revoke a token through an operator object instead of the token value', async () => {
    const token = await issuePublicToken()
    const response = await api.post('/oauth2/revoke', { client_id: PUBLIC_CLIENT_ID, token: { ne: '' } })
    expect(response.status).toBe(400)
    expect((await userinfo(token)).status).toBe(200)
  })

  it('cannot exchange a code through an operator object instead of the code value', async () => {
    const { challenge } = pkcePair()
    const code = await repeatPublicCode(challenge)
    const response = await api.post('/oauth2/token', {
      grant_type: 'authorization_code',
      client_id: PUBLIC_CLIENT_ID,
      code: { ne: '' },
      redirect_uri: PUBLIC_REDIRECT,
      code_verifier: pkcePair().verifier,
    })
    expect(response.status).toBe(400)
    expect(response.data.error).toBe('invalid_request')
    expect(querySql(`SELECT count(*) FROM "Codes" WHERE value = '${code}';`)).toBe('1')
  })

  it('revokes its own token with the client id alone and deletes every row of the user for the client', async () => {
    // A login of another user with the same client, which the revoke must leave alone
    const otherUserToken = 'pkcetestotheruserkiwi01'
    const token = await issuePublicToken()
    expect((await userinfo(token)).status).toBe(200)
    runSql(`INSERT INTO "Tokens"(id,value,scope,"userId","clientId","expiresAt","createdAt","updatedAt") VALUES
      (gen_random_uuid(),'pkcetestexpiredconsent01',ARRAY['${SCOPE}']::varchar[],'${USER_ID}','${PUBLIC_CLIENT_ID}',now() - interval '1 day',now(),now()),
      (gen_random_uuid(),'${otherUserToken}',ARRAY['${SCOPE}']::varchar[],'${REPRESENTING_USER_ID}','${PUBLIC_CLIENT_ID}',now() + interval '1 hour',now(),now());`)
    expect(Number(publicTokenCount())).toBeGreaterThan(1)

    const response = await revokePublic(token)
    expect(response.status).toBe(200)
    expect((await userinfo(token)).status).toBe(401)
    expect(publicTokenCount()).toBe('0')
    expect(querySql(`SELECT count(*) FROM "Tokens" WHERE value = '${otherUserToken}';`)).toBe('1')
    expect((await userinfo(otherUserToken)).status).toBe(200)
    runSql(`DELETE FROM "Tokens" WHERE value = '${otherUserToken}';`)
    expect((await userinfo(WEBSITE_TOKEN)).status).toBe(200)

    /* No consent record is left, so the next login shows the consent screen */
    const { challenge } = pkcePair()
    const next = await authorizePublic({ code_challenge: challenge, code_challenge_method: 'S256' })
    expect(next.status).toBe(200)
    expect(next.data.redirect).toBeUndefined()
    expect(next.data.transactionId).toBeTruthy()
  })

  it('skips consent when the only row of the user for the client has expired', async () => {
    runSql(`DELETE FROM "Tokens" WHERE "userId" = '${USER_ID}' AND "clientId" = '${PUBLIC_CLIENT_ID}';
      INSERT INTO "Tokens"(id,value,scope,"userId","clientId","expiresAt","createdAt","updatedAt") VALUES
      (gen_random_uuid(),'pkcetestexpiredonly01',ARRAY['${SCOPE}']::varchar[],'${USER_ID}','${PUBLIC_CLIENT_ID}',now() - interval '1 day',now(),now());`)
    expect(publicTokenCount()).toBe('1')

    const { verifier, challenge } = pkcePair()
    const code = await repeatPublicCode(challenge)
    const response = await exchangePublic(code, verifier)
    expect(response.status).toBe(200)
  })

  it('cannot revoke a token of another client with its client id', async () => {
    // A public client row of the user, which a revoke that matched the website token would delete
    const seededToken = 'pkcetestrevokeotherclient01'
    runSql(`INSERT INTO "Tokens"(id,value,scope,"userId","clientId","expiresAt","createdAt","updatedAt") VALUES
      (gen_random_uuid(),'${seededToken}',ARRAY['${SCOPE}']::varchar[],'${USER_ID}','${PUBLIC_CLIENT_ID}',now() + interval '1 hour',now(),now());`)
    const before = publicTokenCount()
    expect(Number(before)).toBeGreaterThan(0)

    const response = await revokePublic(WEBSITE_TOKEN)
    expect(response.status).toBe(200)
    expect(querySql(`SELECT count(*) FROM "Tokens" WHERE value = '${WEBSITE_TOKEN}';`)).toBe('1')
    expect((await userinfo(WEBSITE_TOKEN)).status).toBe(200)
    expect(publicTokenCount()).toBe(before)
    runSql(`DELETE FROM "Tokens" WHERE value = '${seededToken}';`)
  })

  it('returns the request state with error redirects, including a denied consent', async () => {
    const state = 'pkce-test-state-0001'
    const missingChallenge = await authorizePublic({ state })
    const missingParams = redirectParams(missingChallenge)
    expect(missingParams.get('error')).toBe('invalid_request')
    expect(missingParams.get('state')).toBe(state)

    const { challenge } = pkcePair()
    const badScope = await authorizePublic({ state, scope: `openid ${SCOPE}`, code_challenge: challenge, code_challenge_method: 'S256' })
    expect(redirectParams(badScope).get('state')).toBe(state)

    const authorizeResponse = await authorizePublic({
      state,
      scope: UNGRANTED_SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    expect(authorizeResponse.data.transactionId).toBeTruthy()
    const denied = await decide(authorizeResponse, { allow: false })
    expect(denied.status).toBe(200)
    const deniedParams = redirectParams(denied)
    expect(deniedParams.get('error')).toBe('access_denied')
    expect(deniedParams.get('state')).toBe(state)
    expect(deniedParams.get('code')).toBeNull()
  })

  it('cannot log in with a passkey, which issues a full-scope token that does not expire', async () => {
    const response = await api.post('/passkeys/verify', {
      client_id: PUBLIC_CLIENT_ID,
      data: { attributes: { response: { id: 'pkce-test-credential' } } },
    })
    expect(response.status).toBe(400)
    expect(response.data.error).toBe('unauthorised_client')
  })

  it('cannot revoke every token of the client', async () => {
    const response = await api.post('/oauth2/revokeall', new URLSearchParams({ client_id: PUBLIC_CLIENT_ID }).toString(), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(response.status).toBe(400)
    expect(response.data.error).toBe('unauthorised_client')
  })
})

describe('confidential client authorization code flow', () => {
  it('works as before with its secret and receives a token that does not expire', async () => {
    const authorizeResponse = await authorize({
      client_id: CONFIDENTIAL_CLIENT_ID,
      redirect_uri: CONFIDENTIAL_REDIRECT,
      scope: SCOPE,
    })
    expect(authorizeResponse.status).toBe(200)
    expect(authorizeResponse.data.transactionId).toBeTruthy()

    const decision = await decide(authorizeResponse)
    expect(decision.status).toBe(200)
    const code = redirectParams(decision).get('code')

    const basic = Buffer.from(`${CONFIDENTIAL_CLIENT_ID}:${CONFIDENTIAL_SECRET}`).toString('base64')
    const response = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CONFIDENTIAL_REDIRECT,
    }, { authorization: `Basic ${basic}` })
    expect(response.status).toBe(200)
    expect(response.data.token_type).toBe('bearer')
    expect(response.data.expires_in).toBeUndefined()

    const expiresAt = querySql(`SELECT coalesce("expiresAt"::text, 'none') FROM "Tokens" WHERE value = '${response.data.access_token}';`)
    expect(expiresAt).toBe('none')
    expect((await userinfo(response.data.access_token)).status).toBe(200)
  })

  it('is refused at the token endpoint without its secret', async () => {
    const response = await authorize({ client_id: CONFIDENTIAL_CLIENT_ID, redirect_uri: CONFIDENTIAL_REDIRECT, scope: SCOPE })
    const code = redirectParams(response).get('code')
    const exchange = await tokenRequest({
      grant_type: 'authorization_code',
      client_id: CONFIDENTIAL_CLIENT_ID,
      code,
      redirect_uri: CONFIDENTIAL_REDIRECT,
    })
    expect(exchange.status).toBe(401)
  })

  it('has PKCE enforced when it sends a code challenge', async () => {
    const { verifier, challenge } = pkcePair()
    const authorizeChallenge = async () => {
      const response = await authorize({
        client_id: CONFIDENTIAL_CLIENT_ID,
        redirect_uri: CONFIDENTIAL_REDIRECT,
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      return redirectParams(response).get('code')
    }
    const fields = {
      grant_type: 'authorization_code',
      client_id: CONFIDENTIAL_CLIENT_ID,
      client_secret: CONFIDENTIAL_SECRET,
      redirect_uri: CONFIDENTIAL_REDIRECT,
    }

    const withoutVerifier = await tokenRequest({ ...fields, code: await authorizeChallenge() })
    expect(withoutVerifier.status).toBe(400)
    expect(withoutVerifier.data.error).toBe('invalid_grant')

    const withVerifier = await tokenRequest({ ...fields, code: await authorizeChallenge(), code_verifier: verifier })
    expect(withVerifier.status).toBe(200)
  })
})

describe('authorize endpoints with a token narrower than the user', () => {
  const narrowBearers = {}

  beforeAll(async () => {
    narrowBearers.public = await loginPublic()
    narrowBearers.confidential = CONFIDENTIAL_NARROW_TOKEN
  })

  it('refuse a narrow token on the consent-skip path and on the consent path', async () => {
    for (const bearer of Object.values(narrowBearers)) {
      for (const scope of [SCOPE, UNGRANTED_SCOPE]) {
        const { challenge } = pkcePair()
        const response = await authorizePublic({ scope, code_challenge: challenge, code_challenge_method: 'S256' }, bearer)
        expect(response.status).toBe(403)
        expect(response.data.redirect).toBeUndefined()
        expect(response.data.transactionId).toBeUndefined()
      }
    }
  })

  it('refuse a narrow token on the implicit grant', async () => {
    for (const bearer of Object.values(narrowBearers)) {
      const response = await authorize({
        response_type: 'token',
        client_id: CONFIDENTIAL_CLIENT_ID,
        redirect_uri: CONFIDENTIAL_REDIRECT,
        scope: '*',
      }, bearer)
      expect(response.status).toBe(403)
      expect(response.data.redirect).toBeUndefined()
      expect(response.data.transactionId).toBeUndefined()
    }
  })

  it('refuse a narrow token on the consent decision, which the website token can still make', async () => {
    const { challenge } = pkcePair()
    const authorizeResponse = await authorizePublic({ scope: UNGRANTED_SCOPE, code_challenge: challenge, code_challenge_method: 'S256' })
    expect(authorizeResponse.data.transactionId).toBeTruthy()

    for (const bearer of Object.values(narrowBearers)) {
      const response = await decide(authorizeResponse, { bearer })
      expect(response.status).toBe(403)
      expect(response.data.redirect).toBeUndefined()
    }

    const decision = await decide(authorizeResponse)
    expect(decision.status).toBe(200)
    expect(redirectParams(decision).get('code')).toBeTruthy()
  })

  it('refuse a full-scope token that represents the user, on both endpoints', async () => {
    const representingAuthorize = (scope) => {
      const { challenge } = pkcePair()
      return api.get('/oauth2/authorize', {
        params: {
          response_type: 'code',
          client_id: PUBLIC_CLIENT_ID,
          redirect_uri: PUBLIC_REDIRECT,
          scope,
          state: crypto.randomBytes(8).toString('hex'),
          code_challenge: challenge,
          code_challenge_method: 'S256',
        },
        headers: { 'authorization': `Bearer ${REPRESENTING_TOKEN}`, 'x-representing': USER_ID },
      })
    }

    for (const scope of [SCOPE, UNGRANTED_SCOPE]) {
      const response = await representingAuthorize(scope)
      expect(response.status).toBe(403)
      expect(response.data.redirect).toBeUndefined()
      expect(response.data.transactionId).toBeUndefined()
      expect(response.data.errors[0].source).toEqual({ parameter: 'x-representing' })
    }

    const { challenge } = pkcePair()
    const authorizeResponse = await authorizePublic({ scope: UNGRANTED_SCOPE, code_challenge: challenge, code_challenge_method: 'S256' })
    expect(authorizeResponse.data.transactionId).toBeTruthy()
    const cookie = (authorizeResponse.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')
    const representingDecision = await api.post('/oauth2/authorize', {
      transactionId: authorizeResponse.data.transactionId,
      allow: true,
    }, { headers: { 'authorization': `Bearer ${REPRESENTING_TOKEN}`, 'x-representing': USER_ID, cookie } })
    expect(representingDecision.status).toBe(403)
    expect(representingDecision.data.redirect).toBeUndefined()

    const decision = await decide(authorizeResponse)
    expect(decision.status).toBe(200)
    expect(redirectParams(decision).get('code')).toBeTruthy()
  })
})

describe('OpenID Connect ID token as a bearer', () => {
  const OPENID_SCOPE = 'openid profile'
  const INVALID_BEARER = 'pkcetestnotatoken000000000000001'
  const openIdTokens = {}

  /* The claims of a JWT, decoded without verifying it */
  const jwtClaims = (token) => {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  }

  const profile = (bearer) => {
    return api.get('/profile', { headers: { authorization: `Bearer ${bearer}` } })
  }

  /* The fields of the first error that do not change per request */
  const errorOf = (response) => {
    const [{ status, code, title, detail, source }] = response.data.errors
    return { status, code, title, detail, source }
  }

  /* A real OpenID Connect login of the user at the confidential client, through consent when it is shown */
  beforeAll(async () => {
    const authorizeResponse = await authorize({
      client_id: CONFIDENTIAL_CLIENT_ID,
      redirect_uri: CONFIDENTIAL_REDIRECT,
      scope: OPENID_SCOPE,
    })
    expect(authorizeResponse.status).toBe(200)
    const response = authorizeResponse.data.redirect ? authorizeResponse : await decide(authorizeResponse)
    const code = redirectParams(response).get('code')
    expect(code).toBeTruthy()

    const basic = Buffer.from(`${CONFIDENTIAL_CLIENT_ID}:${CONFIDENTIAL_SECRET}`).toString('base64')
    const exchange = await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CONFIDENTIAL_REDIRECT,
    }, { authorization: `Basic ${basic}` })
    expect(exchange.status).toBe(200)
    openIdTokens.id = exchange.data.id_token
    openIdTokens.access = exchange.data.access_token
  })

  it('refuses the ID token with the 401 of an invalid token, on a plain endpoint and on both authorize endpoints', async () => {
    const idClaims = jwtClaims(openIdTokens.id)
    expect(idClaims.sub).toBe(USER_ID)
    expect(idClaims.aud).toBe(CONFIDENTIAL_CLIENT_ID)
    expect(idClaims.token_type).toBeUndefined()

    const invalid = await profile(INVALID_BEARER)
    expect(invalid.status).toBe(401)
    const refused = await profile(openIdTokens.id)
    expect(refused.status).toBe(401)
    expect(errorOf(refused)).toEqual(errorOf(invalid))

    for (const scope of [SCOPE, UNGRANTED_SCOPE]) {
      const { challenge } = pkcePair()
      const response = await authorizePublic({ scope, code_challenge: challenge, code_challenge_method: 'S256' }, openIdTokens.id)
      expect(response.status).toBe(401)
      expect(response.data.redirect).toBeUndefined()
      expect(response.data.transactionId).toBeUndefined()
      expect(errorOf(response)).toEqual(errorOf(invalid))
    }

    const { challenge } = pkcePair()
    const authorizeResponse = await authorizePublic({ scope: UNGRANTED_SCOPE, code_challenge: challenge, code_challenge_method: 'S256' })
    expect(authorizeResponse.data.transactionId).toBeTruthy()
    const refusedDecision = await decide(authorizeResponse, { bearer: openIdTokens.id })
    expect(refusedDecision.status).toBe(401)
    expect(refusedDecision.data.redirect).toBeUndefined()
    expect(errorOf(refusedDecision)).toEqual(errorOf(invalid))

    const decision = await decide(authorizeResponse)
    expect(decision.status).toBe(200)
    expect(redirectParams(decision).get('code')).toBeTruthy()
  })

  it('accepts the JWT access token of the same login by its signature', async () => {
    expect(jwtClaims(openIdTokens.access).token_type).toBe('Bearer')

    /* Without its row the access token can only authenticate as a JWT */
    runSql(`DELETE FROM "Tokens" WHERE value = '${openIdTokens.access}';`)
    expect(querySql(`SELECT count(*) FROM "Tokens" WHERE value = '${openIdTokens.access}';`)).toBe('0')

    const info = await userinfo(openIdTokens.access)
    expect(info.status).toBe(200)
    expect(info.data.sub).toBe(USER_ID)
    expect((await profile(openIdTokens.access)).status).toBe(200)
  })
})

describe('session listing', () => {
  const EXPIRED_SESSION_ID = 'd2d2d2d2-0000-4000-8000-0000000000e1'
  const LIVE_SESSION_ID = 'd2d2d2d2-0000-4000-8000-0000000000e2'

  it('lists unexpired and non-expiring tokens only', async () => {
    runSql(`INSERT INTO "Tokens"(id,value,scope,"userId","clientId","expiresAt","createdAt","updatedAt") VALUES
      ('${EXPIRED_SESSION_ID}','pkcetestsessionexpired',ARRAY['${SCOPE}']::varchar[],'${USER_ID}','${PUBLIC_CLIENT_ID}',now() - interval '1 hour',now(),now()),
      ('${LIVE_SESSION_ID}','pkcetestsessionlive',ARRAY['${SCOPE}']::varchar[],'${USER_ID}','${PUBLIC_CLIENT_ID}',now() + interval '1 hour',now(),now());`)
    const websiteSessionId = querySql(`SELECT id FROM "Tokens" WHERE value = '${WEBSITE_TOKEN}';`)
    const listed = querySql(`SELECT count(*) FROM "Tokens" WHERE "userId" = '${USER_ID}' AND ("expiresAt" IS NULL OR "expiresAt" > now());`)

    const response = await api.get(`/users/${USER_ID}/sessions`, {
      params: { 'page[size]': 100 },
      headers: { authorization: `Bearer ${WEBSITE_TOKEN}` },
    })
    expect(response.status).toBe(200)
    const ids = response.data.data.map((session) => session.id)
    expect(ids).toContain(LIVE_SESSION_ID)
    expect(ids).toContain(websiteSessionId)
    expect(ids).not.toContain(EXPIRED_SESSION_ID)
    expect(String(ids.length)).toBe(listed)
    expect(String(response.data.meta.total)).toBe(listed)
  })
})

describe('public client token cleanup', () => {
  const ageDays = (days) => `now() - interval '${days} days'`
  const seedToken = (value, clientId, expiresAt) => {
    return `(gen_random_uuid(),'${value}',ARRAY['${SCOPE}']::varchar[],'${USER_ID}','${clientId}',${expiresAt},now(),now())`
  }

  it('deletes public client tokens only once their expiry is past the retention window', () => {
    runSql(`INSERT INTO "Tokens"(id,value,scope,"userId","clientId","expiresAt","createdAt","updatedAt") VALUES
      ${seedToken('pkcetestprunepublicold', PUBLIC_CLIENT_ID, ageDays(RETENTION_DAYS + 1))},
      ${seedToken('pkcetestprunepublicrecent', PUBLIC_CLIENT_ID, ageDays(RETENTION_DAYS - 1))},
      ${seedToken('pkcetestprunepublicactive', PUBLIC_CLIENT_ID, 'now() + interval \'1 hour\'')},
      ${seedToken('pkcetestpruneconfidentialold', CONFIDENTIAL_CLIENT_ID, ageDays(RETENTION_DAYS + 1))};`)

    const script = [
      'const { prunePublicTokens } = await import("/app/src/cron/publicTokenCleanup.mjs")',
      'const { db } = await import("/app/src/db/index.mjs")',
      'await prunePublicTokens()',
      'await db.close()',
      'process.exit(0)',
    ].join('\n')
    execSync(`docker exec -i ${API_CONTAINER} sh -c 'cat > /tmp/prune-public-tokens.mjs && cd /app && bun /tmp/prune-public-tokens.mjs'`, {
      input: script,
      stdio: ['pipe', 'ignore', 'ignore'],
    })

    const remaining = querySql(`SELECT string_agg(value, ',' ORDER BY value) FROM "Tokens" WHERE value LIKE 'pkcetestprune%';`)
    expect(remaining).toBe('pkcetestpruneconfidentialold,pkcetestprunepublicactive,pkcetestprunepublicrecent')
  })
})
