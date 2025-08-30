// import { authenticator as totp } from 'otplib'
import jwt from 'jsonwebtoken'
import API, {
  authenticated,
  clientAuthenticated,
  GET,
  parameters,
  POST,
} from './API'
import {
  BadRequestAPIError,
  ForbiddenAPIError,
  UnauthorizedAPIError,
} from '../classes/APIError'
import Authentication from '../classes/Authentication'
import {
  OAuthError,
  AccessDeniedOAuthError,
  InvalidClientOAuthError,
  InvalidRequestOAuthError,
  InvalidScopeOAuthError, UnauthorisedClientOAuthError,
  UnsupportedGrantTypeOAuthError,
  UnsupportedResponseTypeOAuthError,
} from '../classes/OAuthError'
import Permission from '../classes/Permission'
import { oAuthTokenGenerator, transactionGenerator } from '../classes/TokenGenerators'
import config from '../config'
import { Client, Code, User } from '../db'
import Token from '../db/Token'
import { isValidRedirectUri } from '../helpers/Validators'

const transactionTimeoutMinutes = 10
const transactionTimeout = transactionTimeoutMinutes * 60 * 1000
// const sessionExpiryTime = 60 * 60 * 1000

/**
 * Class for managing OAuth 2 requests
 * @class
 */
class OAuth extends API {
  static transactions = new Map()

  /**
   * @inheritdoc
   */
  get type () {
    return 'oauth2'
  }

  /**
   * Get user with groups for ID token generation
   * @param {string} userId User ID to look up
   * @returns {Promise<object|null>} User object with groups or null
   */
  getUserForIdToken (userId) {
    return User.findOne({
      where: { id: userId },
      include: ['groups'],
    })
  }

  /**
   * Extract Jira roles from user groups
   * @param {object[]} groups User groups array
   * @returns {string[]} Array of unique Jira roles
   */
  extractJiraRoles (groups) {
    if (!groups || !Array.isArray(groups)) {
      return []
    }
    
    const jiraRoles = groups.flatMap((group) => {
      return group.jiraRoles && Array.isArray(group.jiraRoles) ? group.jiraRoles : []
    })
    
    return [...new Set(jiraRoles)]
  }

  /**
   * Validate JWT secret configuration
   * @throws {Error} If JWT secret is invalid or insecure
   */
  validateJwtSecret () {
    if (!config.jwt.secret) {
      throw new Error('JWT secret is required but not configured. Set FRAPI_JWT_SECRET environment variable.')
    }
    
    if (typeof config.jwt.secret !== 'string') {
      throw new Error('JWT secret must be a string.')
    }
    
    if (config.jwt.secret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters long for security. Current length: ' + config.jwt.secret.length)
    }
  }

  /**
   * Generate a JWT access token
   * @param {object} params Parameters for access token generation
   * @param {object} params.user User object
   * @param {string[]} params.scopes Granted OAuth scopes
   * @param {string} params.clientId OAuth client ID
   * @returns {string} JWT access token
   */
  generateJwtAccessToken ({ user, scopes, clientId }) {
    this.validateJwtSecret()
    
    const accessTokenPayload = {
      iss: config.server.externalUrl,
      sub: user.id,
      aud: clientId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
      iat: Math.floor(Date.now() / 1000),
      scope: scopes.join(' '),
      token_type: 'Bearer',
    }

    return jwt.sign(accessTokenPayload, config.jwt.secret, { algorithm: 'HS256' })
  }

  /**
   * Generate an ID token for OpenID Connect
   * @param {object} params Parameters for ID token generation
   * @param {object} params.user User object with groups
   * @param {string[]} params.scopes Requested OAuth scopes
   * @param {string} params.clientId OAuth client ID
   * @param {string} params.nonce Nonce for replay protection
   * @returns {string|null} JWT ID token or null if openid scope not requested
   */
  generateIdToken ({ user, scopes, clientId, nonce }) {
    if (!scopes.includes('openid')) {
      return null
    }
    
    this.validateJwtSecret()

    const idTokenPayload = {
      iss: config.server.externalUrl,
      sub: user.id,
      aud: clientId,
      exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
      iat: Math.floor(Date.now() / 1000),
    }

    if (nonce) {
      idTokenPayload.nonce = nonce
    }

    if (scopes.includes('profile')) {
      idTokenPayload.name = user.displayName()
      idTokenPayload.preferred_username = user.displayName()
      idTokenPayload.profile = `${config.server.externalUrl}/profile/overview`
      idTokenPayload.updated_at = Math.floor(user.updatedAt.getTime() / 1000)
    }

    if (scopes.includes('email')) {
      idTokenPayload.email = user.email
      idTokenPayload.email_verified = user.verified
    }

    if (scopes.includes('groups')) {
      idTokenPayload.groups = this.extractJiraRoles(user.groups)
    }

    // Using HMAC SHA-256 signing
    return jwt.sign(idTokenPayload, config.jwt.secret, { algorithm: 'HS256' })
  }

  /**
   * Endpoint for OAuth authorize decision screen info requests
   * @endpoint
   */
  @GET('/oauth2/authorize')
  @authenticated
  @parameters('client_id')
  async authorize (ctx) {
    const {
      response_type: responseType,
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      nonce,
    } = ctx.query

    /* Check valid parameters */
    if (!isValidRedirectUri(redirectUri)) {
      throw new BadRequestAPIError({ parameter: 'redirect_uri' })
    }

    if (!state) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('state'))
    }

    if (!responseType) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('response_type'))
    }

    if (typeof scope !== 'string' || scope.length === 0) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('scope'))
    }

    /* Check valid scopes */
    const scopes = scope.split(' ')
    const invalidScopes = scopes.filter((scopeEntry) => {
      return Permission.isValidOAuthScope(scopeEntry) === false
    })
    if (invalidScopes.length > 0) {
      return callbackError(redirectUri, throw new InvalidScopeOAuthError(invalidScopes.join(',')))
    }

    /* Check if OAuth client exists */
    const client = await Client.findOne({
      where: { id: clientId },
    })
    if (!client) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('client'))
    }

    /* Implicit Grant requires the redirectUri to be the same as stored in the OAuth client database entry
    * as the redirectUri serves as the only form of client authentication */
    if (responseType === 'token') {
      if (redirectUri !== client.redirectUri) {
        return callbackError(redirectUri, new InvalidRequestOAuthError('redirect_uri'))
      }
    }

    if (responseType === 'code' || responseType === 'token') {
      /* Check if the user has previously granted this application access to these permissions */
      const existingToken = await Token.findOne({
        where: {
          userId: ctx.state.user.id,
          clientId,
          scope: {
            contains: scopes,
          },
        },
      })

      /* User has previously granted access, skip immediately to returning an Auth code */
      if (existingToken && responseType === 'code') {
        const code = await Code.create({
          value: await oAuthTokenGenerator(),
          scope: scopes,
          redirectUri,
          clientId,
          userId: ctx.state.user.id,
          nonce,
        })

        return callbackResponse(redirectUri, {
          code: code.value,
          state,
        })
      }

      /* User has previously granted access, skip immediately to returning a token */
      if (existingToken && responseType === 'token') {
        let tokenValue = null

        // Use JWT access tokens only for OpenID Connect flows
        if (scopes.includes('openid')) {
          tokenValue = this.generateJwtAccessToken({
            user: ctx.state.user,
            scopes,
            clientId,
          })
        } else {
          // Use traditional opaque tokens for regular OAuth flows
          tokenValue = await oAuthTokenGenerator()
        }

        const token = await Token.create({
          value: tokenValue,
          scope: scopes,
          clientId,
          userId: ctx.state.user.id,
        })

        const response = {
          access_token: token.value,
          token_type: 'bearer',
          scope: scopes.join(','),
          state,
        }

        // Generate ID token if openid scope is requested
        if (scopes.includes('openid')) {
          const idToken = this.generateIdToken({
            user: ctx.state.user,
            scopes,
            clientId,
            nonce,
          })
          if (idToken) {
            response.id_token = idToken
          }
        }

        return callbackResponse(redirectUri, response)
      }

      /* User has not previously granted access, return authorize decision information */
      const transactionId = await transactionGenerator()
      OAuth.transactions.set(transactionId, {
        responseType,
        redirectUri,
        scopes,
        clientId,
        state,
        nonce,
        userId: ctx.state.user.id,
      })

      setTimeout(() => {
        OAuth.transactions.delete(transactionId)
      }, transactionTimeout)

      ctx.session.transactionId = transactionId
      return {
        transactionId,
        scopes,
        clientId,
        clientName: client.name,
        firstParty: client.firstParty,
        state,
      }
    }

    return callbackError(redirectUri, new UnsupportedResponseTypeOAuthError())
  }

  /**
   * Endpoint for OAuth2 authorize decision request
   * @endpoint
   */
  @POST('/oauth2/authorize')
  @authenticated
  async decision (ctx) {
    const { transactionId, allow } = ctx.request.body

    /* Validate parameters */
    if (!transactionId) {
      throw new BadRequestAPIError({ pointer: 'transactionId' })
    }

    if (typeof allow === 'undefined') {
      throw new BadRequestAPIError({ pointer: 'allow' })
    }

    /* Lookup this oauth transaction */
    const transaction = OAuth.transactions.get(transactionId)
    if (!transaction) {
      throw new ForbiddenAPIError({ parameter: 'transactionId' })
    }
    OAuth.transactions.delete(transactionId)

    const {
      redirectUri,
      scopes,
      clientId,
      userId,
      state,
      nonce,
    } = transaction

    /* As a security measure transaction ID is both stored as a session cookie and as a request parameter
    * Check that they match */
    const sessionTransaction = ctx.session.transactionId
    if (transactionId !== sessionTransaction) {
      throw new ForbiddenAPIError({ parameter: 'transactionId' })
    }

    /* This transaction does not belong to the currently authenticated user */
    if (ctx.state.user.id !== userId) {
      throw new ForbiddenAPIError({})
    }

    /* User denied access to the application */
    if (!allow) {
      return callbackError(redirectUri, new AccessDeniedOAuthError('allow'))
    }

    /* User allowed access, return authorization code */
    if (transaction.responseType === 'code') {
      const code = await Code.create({
        value: await oAuthTokenGenerator(),
        scope: scopes,
        redirectUri,
        clientId,
        userId,
        nonce,
      })

      return callbackResponse(redirectUri, {
        code: code.value,
        state,
      })
    }

    /* User allowed access, return bearer token */
    if (transaction.responseType === 'token') {
      let tokenValue = null
      let user = null

      // Use JWT access tokens only for OpenID Connect flows
      if (transaction.scopes.includes('openid')) {
        user = await this.getUserForIdToken(transaction.userId)
        tokenValue = this.generateJwtAccessToken({
          user,
          scopes: transaction.scopes,
          clientId: transaction.clientId,
        })
      } else {
        // Use traditional opaque tokens for regular OAuth flows
        tokenValue = await oAuthTokenGenerator()
      }

      const token = await Token.create({
        value: tokenValue,
        scope: transaction.scopes,
        clientId: transaction.clientId,
        userId: transaction.userId,
      })

      const response = {
        access_token: token.value,
        token_type: 'bearer',
        scope: transaction.scopes.join(','),
        state: transaction.state,
      }

      // Generate ID token if openid scope is requested
      if (transaction.scopes.includes('openid') && user) {
        const idToken = this.generateIdToken({
          user,
          scopes: transaction.scopes,
          clientId: transaction.clientId,
          nonce: transaction.nonce,
        })
        if (idToken) {
          response.id_token = idToken
        }
      }

      return callbackResponse(redirectUri, response)
    }
    return undefined
  }


  /**
   * Endpoint for OAuth2 Token exchange and ROPC request
   * @endpoint
   */
  @POST('/oauth2/token')
  @clientAuthenticated
  token (ctx) {
    const { grant_type: grantType } = ctx.request.body
    if (!grantType) {
      throw new InvalidRequestOAuthError('grant_type')
    }

    if (grantType === 'authorization_code') {
      return this.authoriseTokenExchange(ctx)
    }

    if (grantType === 'password') {
      return this.resourceOwnerPasswordCredentials(ctx)
    }

    throw new UnsupportedGrantTypeOAuthError()
  }


  /**
   * Handler for OAuth2 Token Exchange requests
   * @endpoint
   */
  async authoriseTokenExchange (ctx) {
    const {
      code,
      redirect_uri: redirectUri,
    } = ctx.request.body

    /* Validate parameters */
    if (!code) {
      throw new InvalidRequestOAuthError('code')
    }

    if (!redirectUri) {
      throw new InvalidRequestOAuthError('redirect_uri')
    }

    /* Lookup the Auth Code */
    const { client } = ctx.state
    const authCode = await Code.findOne({
      where: {
        value: code,
      },
    })

    if (!authCode) {
      throw new InvalidRequestOAuthError('code')
    }

    /* Only 10 minutes is allowed to pass between requesting an auth code and exchanging it for a token */
    if (Date() - authCode.createdAt > transactionTimeout) {
      throw new InvalidRequestOAuthError('code')
    }

    /* The currently authenticated client does not match the client requesting the auth code */
    if (authCode.clientId !== client.id) {
      throw new InvalidClientOAuthError()
    }

    /* The redirectUri in the current request does not match the redirectUri of the auth code request */
    if (authCode.redirectUri !== redirectUri) {
      throw new InvalidRequestOAuthError('redirect_uri')
    }

    /* Exchange successful, return bearer token */
    let tokenValue = null
    let user = null

    // Use JWT access tokens only for OpenID Connect flows
    if (authCode.scope.includes('openid')) {
      user = await this.getUserForIdToken(authCode.userId)
      tokenValue = this.generateJwtAccessToken({
        user,
        scopes: authCode.scope,
        clientId: authCode.clientId,
      })
    } else {
      // Use traditional opaque tokens for regular OAuth flows
      tokenValue = await oAuthTokenGenerator()
    }

    const token = await Token.create({
      value: tokenValue,
      scope: authCode.scope,
      userId: authCode.userId,
      clientId: authCode.clientId,
    })

    const response = {
      access_token: token.value,
      token_type: 'bearer',
    }

    // Generate ID token if openid scope is requested
    if (authCode.scope.includes('openid') && user) {
      const idToken = this.generateIdToken({
        user,
        scopes: authCode.scope,
        clientId: authCode.clientId,
        nonce: authCode.nonce,
      })
      if (idToken) {
        response.id_token = idToken
      }
    }

    return response
  }


  /**
   * Handler for Resource Owner Password Credentials Requests
   * @endpoint
   */
  async resourceOwnerPasswordCredentials (ctx) {
    let { username, password, scope } = ctx.request.body

    /* Validate parameters */
    if (!username) {
      throw new InvalidRequestOAuthError('username')
    }

    if (!password) {
      throw new InvalidRequestOAuthError('password')
    }

    /* For ROPC, if no scope is defined we grant full access */
    if (typeof scope === 'undefined') {
      scope = '*'
    }

    /* If scope is defined but its value is invalid, we throw an error */
    if (typeof scope !== 'string' || scope.length === 0) {
      throw new InvalidRequestOAuthError('scope')
    }

    const scopes = scope.split(' ')
    const invalidScopes = scopes.filter((scopeEntry) => {
      return Permission.isValidOAuthScope(scopeEntry) === false
    })
    if (invalidScopes.length > 0) {
      throw new InvalidScopeOAuthError(invalidScopes.join(','))
    }

    const { client } = ctx.state

    /* Only first party Fuel Rats clients are allowed to use ROPC */
    if (!client.firstParty) {
      throw new UnauthorisedClientOAuthError()
    }

    /* ROPC clients are required to provide a user agent */
    if (!ctx.state.userAgent) {
      throw new InvalidRequestOAuthError('userAgent')
    }

    /* ROPC clients are required to provide a 'fingerprint' that uniquely identifies the current device */
    if (!ctx.state.fingerprint) {
      throw new InvalidRequestOAuthError('X-Fingerprint')
    }

    /* Validate username and password */
    const user = await Authentication.passwordAuthenticate({ email: username, password })
    if (!user) {
      throw new UnauthorizedAPIError({})
    }

    //     /* Check if the user has an existing login session */
    //     const existingSession = await Session.findOne({
    //       where: {
    //         ip: ctx.request.ip,
    //         fingerprint: ctx.state.fingerprint,
    //         userId: user.id,
    //       },
    //     })

    //     /* No existing session is found, send a session verification email and error */
    //     if (!existingSession) {
    //       await Sessions.createSession(ctx, user)
    //       throw new VerificationRequiredAPIError({})
    //     }

    //     if (existingSession.verified === false) {
    //       if (!ctx.request.body.verify || existingSession.createdAt - Date() > sessionExpiryTime) {
    //         /* An existing session was found but it is not yet verified and the client did not pass a verification token.
    //         *  Assume the user has lost their verification email and send a new one.
    //         * */
    //         await existingSession.destroy()
    //         await Sessions.createSession(ctx, user)
    //         throw new VerificationRequiredAPIError({})
    //       } else if (ctx.request.body.verify.toUpperCase() !== existingSession.code) {
    //         /* An existing unverified session was found and the user passed a code,
    //         but the code was invalid, throw an error */
    //         throw new InvalidRequestOAuthError('verify')
    //       }
    //     }

    //     /* An existing session was found and it was either already verified,
    //     or the client passed a valid verification token. Return bearer token. */
    //     await existingSession.update({
    //       verified: true,
    //       lastAccess: Date.now(),
    //     })

    const token = await Token.create({
      value: await oAuthTokenGenerator(),
      clientId: client.id,
      userId: user.id,
      scope: ['*'],
    })

    return {
      access_token: token.value,
      token_type: 'bearer',
    }
  }

  /**
   * Endpoint for OAuth 2 token revocation requests
   * @endpoint
   */
  @POST('/oauth2/revoke')
  @clientAuthenticated
  async revoke (ctx) {
    const { token } = ctx.request.body

    if (!token) {
      throw new InvalidRequestOAuthError('token')
    }

    const authToken = await Token.findOne({
      where: {
        value: token,
        clientId: ctx.state.client.id,
      },
    })

    if (authToken) {
      await authToken.destroy()
    }

    return {}
  }

  /**
   * Endpoint for OAuth2 revoke all client tokens requests
   * @endpoint
   */
  @POST('/oauth2/revokeall')
  @clientAuthenticated
  async revokeAll (ctx) {
    await Token.destroy({
      where: {
        clientId: ctx.state.client.id,
      },
    })

    return {}
  }

  /**
   * OpenID Connect UserInfo endpoint (GET)
   * @endpoint
   */
  @GET('/oauth2/userinfo')
  @authenticated
  userinfo (ctx) {
    const { user, scope } = ctx.state

    const userinfo = {
      sub: user.id,
    }

    if (!scope || scope.includes('*') || scope.includes('profile')) {
      userinfo.name = user.displayName()
      userinfo.preferred_username = user.displayName()
      userinfo.profile = `${config.frontend.url}/profile/overview`
      userinfo.updated_at = Math.floor(user.updatedAt.getTime() / 1000)
    }

    if (!scope || scope.includes('*') || scope.includes('email')) {
      userinfo.email = user.email
      userinfo.email_verified = user.verified
    }

    if (user.groups && (!scope || scope.includes('*') || scope.includes('groups'))) {
      userinfo.groups = this.extractJiraRoles(user.groups)
    }

    return userinfo
  }

  /**
   * OpenID Connect UserInfo endpoint (POST)
   * @endpoint
   */
  @POST('/oauth2/userinfo')
  @authenticated
  userinfoPost (ctx) {
    return this.userinfo(ctx)
  }

  /**
   * OpenID Connect Discovery endpoint
   * @endpoint
   */
  @GET('/.well-known/openid-configuration')
  openidConfiguration () {
    const issuer = config.server.externalUrl

    return {
      issuer,
      authorization_endpoint: `${issuer}/oauth2/authorize`,
      token_endpoint: `${issuer}/oauth2/token`,
      userinfo_endpoint: `${issuer}/oauth2/userinfo`,
      revocation_endpoint: `${issuer}/oauth2/revoke`,
      response_types_supported: ['code', 'token'],
      grant_types_supported: ['authorization_code', 'password', 'implicit'],
      subject_types_supported: ['public'],
      // eslint-disable-next-line id-length
      id_token_signing_alg_values_supported: ['HS256'],
      scopes_supported: ['openid', 'profile', 'email', 'groups'],
      // eslint-disable-next-line id-length
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      claims_supported: [
        'sub',
        'name',
        'preferred_username',
        'email',
        'email_verified',
        'groups',
        'profile',
        'updated_at',
      ],
      code_challenge_methods_supported: [],
      response_modes_supported: ['query', 'fragment'],
    }
  }
}

/**
 * Transform the body output of an endpoint into an OAuth callback uri that the front-end will redirect to
 * @param {string} redirectUri base redirect uri
 * @param {object} object body data
 * @returns {{redirect: string}} Redirect uri for the front-end
 */
function callbackResponse (redirectUri, object) {
  const url = new URL(redirectUri)

  for (const [key, value] of Object.entries(object)) {
    url.searchParams.append(key, value)
  }

  return {
    redirect: url.toString(),
  }
}

/**
 * Transform the error output of an endpoint into an OAuth callback uri that the front-end will redirect to
 * @param {string} redirectUri base redirect uri
 * @param {OAuthError} error oauth error
 * @returns {{redirect: string}} Redirect uri for the front-end
 */
function callbackError (redirectUri, error) {
  const url = new URL(redirectUri)
  url.searchParams.append('error', error.error)

  if (error.description) {
    url.searchParams.append('error_description', error.description)
  }

  if (error.state) {
    url.searchParams.append('state', error.state)
  }

  return {
    redirect: url.toString(),
  }
}

export default OAuth
