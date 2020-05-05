import {
  BadRequestAPIError,
  ForbiddenAPIError,
  UnauthorizedAPIError,
  VerificationRequiredAPIError,
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
import Sessions from '../classes/Sessions'
import { oAuthTokenGenerator, transactionGenerator } from '../classes/TokenGenerators'
import { Client, Code, Session } from '../db'
import Token from '../db/Token'
import { isValidRedirectUri } from '../helpers/Validators'
import API, {
  authenticated,
  clientAuthenticated,
  GET,
  parameters,
  POST,
} from './API'

const transactionTimeoutMinutes = 10
const transactionTimeout = transactionTimeoutMinutes * 60 * 1000
const sessionExpiryTime = 60 * 60 * 1000

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
    } = ctx.query

    if (!isValidRedirectUri(redirectUri)) {
      throw new BadRequestAPIError({ parameter: 'redirect_uri' })
    }

    if (!state) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('state'))
    }

    if (!responseType) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('response_type'))
    }

    if (!scope || typeof scope !== 'string' || scope.length === 0) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('scope'))
    }

    const scopes = scope.split(' ')
    const invalidScopes = scopes.filter((scopeEntry) => {
      return Permission.isValidOAuthScope(scopeEntry) === false
    })
    if (invalidScopes.length > 0) {
      return callbackError(redirectUri, throw new InvalidScopeOAuthError(invalidScopes.join(',')))
    }

    const client = await Client.findOne({
      where: { id: clientId },
    })
    if (!client) {
      return callbackError(redirectUri, new InvalidRequestOAuthError('client'))
    }

    if (responseType === 'token') {
      if (redirectUri !== client.redirectUri) {
        return callbackError(redirectUri, new InvalidRequestOAuthError('redirect_uri'))
      }
    }

    if (responseType === 'code' || responseType === 'token') {
      const transactionId = await transactionGenerator()
      OAuth.transactions.set(transactionId, {
        responseType,
        redirectUri,
        scopes,
        clientId,
        state,
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

    if (!transactionId) {
      throw new BadRequestAPIError({ pointer: 'transactionId' })
    }

    if (typeof allow === 'undefined') {
      throw new BadRequestAPIError({ pointer: 'allow' })
    }

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
    } = transaction

    const sessionTransaction = ctx.session.transactionId
    if (transactionId !== sessionTransaction) {
      throw new ForbiddenAPIError({ parameter: 'transactionId' })
    }

    if (ctx.state.user.id !== userId) {
      throw new ForbiddenAPIError({})
    }

    if (!allow) {
      return callbackError(redirectUri, new AccessDeniedOAuthError('allow'))
    }

    if (transaction.responseType === 'code') {
      const code = await Code.create({
        value: await oAuthTokenGenerator(),
        scope: scopes,
        redirectUri,
        clientId,
        userId,
      })

      return callbackResponse(redirectUri, {
        code: code.value,
        state,
      })
    }

    if (transaction.responseType === 'token') {
      const token = await Token.create({
        value: await oAuthTokenGenerator(),
        scope: transaction.scopes,
        clientId: transaction.clientId,
        userId: transaction.userId,
      })

      return callbackResponse(redirectUri, {
        access_token: token.value,
        token_type: 'bearer',
        scope: transaction.scopes.join(','),
        state: transaction.state,
      })
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

    if (!code) {
      throw new InvalidRequestOAuthError('code')
    }

    if (!redirectUri) {
      throw new InvalidRequestOAuthError('redirect_uri')
    }

    const { client } = ctx.state
    const authCode = await Code.findOne({
      where: {
        value: code,
      },
    })

    if (!authCode) {
      throw new InvalidRequestOAuthError('code')
    }

    if (Date() - authCode.createdAt > transactionTimeout) {
      throw new InvalidRequestOAuthError('code')
    }

    if (authCode.clientId !== client.id) {
      throw new InvalidClientOAuthError()
    }

    if (authCode.redirectUri !== redirectUri) {
      throw new InvalidRequestOAuthError('redirect_uri')
    }

    const token = await Token.create({
      value: await oAuthTokenGenerator(),
      scope: authCode.scope,
      userId: authCode.userId,
      clientId: authCode.clientId,
    })

    return {
      access_token: token.value,
      token_type: 'bearer',
    }
  }


  /**
   * Handler for Resource Owner Password Credentials Requests
   * @endpoint
   */
  async resourceOwnerPasswordCredentials (ctx) {
    let { username, password, scope } = ctx.request.body

    if (!username) {
      throw new InvalidRequestOAuthError('username')
    }

    if (!password) {
      throw new InvalidRequestOAuthError('password')
    }

    if (typeof scope === 'undefined') {
      scope = '*'
    }
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

    if (!client.firstParty) {
      throw new UnauthorisedClientOAuthError()
    }

    if (!ctx.state.userAgent) {
      throw new InvalidRequestOAuthError('userAgent')
    }

    if (!ctx.state.fingerprint) {
      throw new InvalidRequestOAuthError('X-Fingerprint')
    }

    const user = await Authentication.passwordAuthenticate({ email: username, password })
    if (!user) {
      throw new UnauthorizedAPIError({})
    }

    const existingSession = await Session.findOne({
      where: {
        ip: ctx.request.ip,
        fingerprint: ctx.state.fingerprint,
      },
    })

    if (!existingSession) {
      await Sessions.createSession(ctx, user)
      throw new VerificationRequiredAPIError({})
    }

    if (existingSession.verified === false) {
      if (!ctx.request.body.verify || existingSession.createdAt - Date() > sessionExpiryTime) {
        await existingSession.destroy()
        await Sessions.createSession(ctx, user)
        throw new VerificationRequiredAPIError({})
      } else if (ctx.request.body.verify.toUpperCase() !== existingSession.code) {
        throw new InvalidRequestOAuthError('verify')
      }
    }

    await existingSession.update({
      verified: true,
      lastAccess: Date.now(),
    })

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

    const authToken = Token.findOne({
      value: token,
      clientId: ctx.state.client.id,
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
