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
const SEED_SECRET = '$2b$12$seedonlyseedonlyseedonlyseedonlyseedonlyseedonlyseedonlyoK'
const LEGACY_CODE = 'pkcetestlegacycodewithoutchallenge01'

const SCOPE = 'rats.read.me'
const PUBLIC_LIFETIME_SECONDS = 12 * 60 * 60
const RETENTION_DAYS = 30

const cleanupSql = `
DELETE FROM "Codes" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" = '${USER_ID}';
DELETE FROM "Tokens" WHERE "clientId" IN ('${CLIENT_IDS.join("','")}') OR "userId" = '${USER_ID}';
DELETE FROM "Clients" WHERE id IN ('${CLIENT_IDS.join("','")}');
DELETE FROM "Users" WHERE id = '${USER_ID}';
`

const seedSql = ({ publicSecretHash, confidentialSecretHash }) => {
  return `
BEGIN;
INSERT INTO "Users"(id,email,password,status,"createdAt","updatedAt") VALUES
 ('${USER_ID}','${USER_EMAIL}','disabled','active',now(),now());
INSERT INTO "Clients"(id,name,secret,"redirectUri","userId","firstParty","public","createdAt","updatedAt") VALUES
 ('${WEBSITE_CLIENT_ID}','PKCE Test Website','${SEED_SECRET}',NULL,'${USER_ID}',true,false,now(),now()),
 ('${PUBLIC_CLIENT_ID}','PKCE Test Kiwi','${publicSecretHash}','${PUBLIC_REDIRECT}','${USER_ID}',false,true,now(),now()),
 ('${CONFIDENTIAL_CLIENT_ID}','PKCE Test Dispatch','${confidentialSecretHash}','${CONFIDENTIAL_REDIRECT}','${USER_ID}',false,false,now(),now());
INSERT INTO "Tokens"(id,value,scope,"userId","clientId","createdAt","updatedAt") VALUES
 (gen_random_uuid(),'${WEBSITE_TOKEN}',ARRAY['*']::varchar[],'${USER_ID}','${WEBSITE_CLIENT_ID}',now(),now());
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

const authorize = (params) => {
  return api.get('/oauth2/authorize', {
    params: { response_type: 'code', state: crypto.randomBytes(8).toString('hex'), ...params },
    headers: { authorization: `Bearer ${WEBSITE_TOKEN}` },
  })
}

const authorizePublic = (params = {}) => {
  return authorize({ client_id: PUBLIC_CLIENT_ID, redirect_uri: PUBLIC_REDIRECT, scope: SCOPE, ...params })
}

const decide = (authorizeResponse) => {
  const cookie = (authorizeResponse.headers['set-cookie'] ?? []).map((value) => value.split(';')[0]).join('; ')
  return api.post('/oauth2/authorize', { transactionId: authorizeResponse.data.transactionId, allow: true }, {
    headers: { authorization: `Bearer ${WEBSITE_TOKEN}`, cookie },
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

  it('revokes its own token with the client id alone', async () => {
    const token = await issuePublicToken()
    expect((await userinfo(token)).status).toBe(200)

    const response = await api.post('/oauth2/revoke', new URLSearchParams({ client_id: PUBLIC_CLIENT_ID, token }).toString(), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(response.status).toBe(200)
    expect((await userinfo(token)).status).toBe(401)
    expect(querySql(`SELECT count(*) FROM "Tokens" WHERE value = '${token}';`)).toBe('0')
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
