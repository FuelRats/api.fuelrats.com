import jwt from 'jsonwebtoken'
import { verifySync as otpVerify } from 'otplib'
import { hashPassword, verifyPassword, getHashRounds } from '../helpers/password'
import { verifyRecoveryCode } from '../helpers/recoveryCodes'
import UUID from 'pure-uuid'
import config from '../config'
import * as constants from '../constants'
import {
  User, Token, Client, Reset, Authenticator, Passkey,
} from '../db'
import { UUID as UUIDPattern } from '../helpers/Validators'
import { logMetric } from '../logging'

import Anope from './Anope'
import {
  AuthenticatorRequiredAPIError,
  GoneAPIError,
  UnauthorizedAPIError,
  ResetRequiredAPIError,
  ForbiddenAPIError,
} from './APIError'
import Permission from './Permission'

const bearerTokenHeaderOffset = 7
const basicAuthHeaderOffset = 6
const expectedJwtParts = 3

/**
 * @classdesc Class for handling authentication mechanisms
 * @class
 */
class Authentication {
  /**
   * Perform password authentication with email and password
   * @param {object} arg function arguments object
   * @param {string} arg.email the email of the user to authenticate
   * @param {string} arg.password the password of the user to authenticate
   * @param {string} [arg.code] optional 2FA code
   * @returns {Promise<undefined|Promise<db.Model>>} A promise returning the authenticated user object
   */
  static async passwordAuthenticate ({ email, password, code }) {
    if (!email || !password) {
      return undefined
    }

    // const user = await User.findByEmail(email)

    const user = await User.findOne({
      where: {
        email: { ilike: email },
        suspended: null,
        status: 'active',
      },
    })
    if (!user) {
      return undefined
    }

    const requiredResets = await Reset.findAll({
      where: {
        userId: user.id,
        required: true,
      },
    })

    if (requiredResets.length > 0) {
      throw new ResetRequiredAPIError({
        pointer: '/data/attributes/email',
      })
    }

    const result = await verifyPassword(password, user.password)
    if (result === false) {
      logMetric('authentication_failure', {
        _auth_method: 'password',
        _failure_reason: 'invalid_password',
      }, 'Password authentication failed')
      return undefined
    }
    if (user.isSuspended() === true) {
      throw new GoneAPIError({ pointer: '/data/attributes/email' })
    }

    if (getHashRounds(user.password) > constants.bcryptRoundsCount) {
      const newRoundPassword = await hashPassword(password, constants.bcryptRoundsCount)
      User.update({
        password: newRoundPassword,
      }, {
        where: { id: user.id },
      })
    }

    // Check for 2FA requirement
    const authenticator = await Authenticator.findOne({
      where: {
        userId: user.id,
      },
    })

    if (authenticator) {
      if (!code) {
        throw new AuthenticatorRequiredAPIError({
          pointer: '/data/attributes/code',
        })
      }

      let isValidCode
      let usedRecoveryCode = false
      try {
        isValidCode = otpVerify({ token: code, secret: authenticator.secret }).valid
      } catch {
        isValidCode = false
      }

      if (!isValidCode) {
        const matchIndex = await verifyRecoveryCode(code, authenticator.recoveryCodes)
        if (matchIndex !== -1) {
          isValidCode = true
          usedRecoveryCode = true
          const remaining = authenticator.recoveryCodes.filter((_, i) => {
            return i !== matchIndex
          })
          await authenticator.update({ recoveryCodes: remaining })
        }
      }

      if (!isValidCode) {
        logMetric('authentication_failure', {
          _auth_method: 'password_2fa',
          _failure_reason: 'invalid_2fa_code',
          _user_id: user.id,
        }, '2FA authentication failed')
        throw new AuthenticatorRequiredAPIError({
          pointer: '/data/attributes/code',
        })
      }

      if (usedRecoveryCode) {
        logMetric('authentication_recovery_code_used', {
          _user_id: user.id,
          _remaining_codes: authenticator.recoveryCodes.length,
        }, `Recovery code used for user ${user.id}`)
      }
    }

    // Log successful password authentication
    logMetric('authentication_success', {
      _auth_method: authenticator ? 'password_2fa' : 'password',
      _user_id: user.id,
      _has_2fa: Boolean(authenticator),
    }, 'Password authentication successful')

    return User.findOne({
      where: {
        email: { ilike: email },
        suspended: null,
        status: 'active',
      },
    })
  }

  /**
   * Perform passkey authentication with WebAuthn response
   * @param {object} arg function arguments object
   * @param {string} arg.userId the ID of the user to authenticate
   * @param {object} arg.passkeyResponse the WebAuthn authentication response
   * @param {string} arg.expectedChallenge the challenge expected for this authentication
   * @returns {Promise<User|undefined>} A promise returning the authenticated user object
   */
  static async passkeyAuthenticate ({ userId, passkeyResponse, expectedChallenge }) {
    if (!userId || !passkeyResponse || !expectedChallenge) {
      return undefined
    }

    const user = await User.findOne({
      where: {
        id: userId,
        suspended: null,
        status: 'active',
      },
    })

    if (!user) {
      return undefined
    }

    if (user.isSuspended() === true) {
      throw new GoneAPIError({ detail: 'User account is suspended' })
    }

    const passkey = await Passkey.findOne({
      where: {
        credentialId: passkeyResponse.id,
        userId: user.id,
      },
    })

    if (!passkey) {
      return undefined
    }

    // Verify the passkey response
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server')
    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response: passkeyResponse,
        expectedChallenge,
        expectedOrigin: config.server.externalUrl,
        expectedRPID: new URL(config.frontend.url).hostname,
        authenticator: {
          credentialID: Buffer.from(passkey.credentialId, 'base64url'),
          credentialPublicKey: Buffer.from(passkey.publicKey, 'base64url'),
          counter: passkey.counter,
        },
      })
    } catch {
      return undefined
    }

    if (!verification.verified) {
      logMetric('authentication_failure', {
        _auth_method: 'passkey',
        _failure_reason: 'verification_failed',
        _user_id: userId,
      }, 'Passkey verification failed')
      return undefined
    }

    // Update passkey counter
    await passkey.update({
      counter: verification.authenticationInfo.newCounter,
    })

    logMetric('authentication_success', {
      _auth_method: 'passkey',
      _user_id: userId,
      _passkey_name: passkey.name,
    }, 'Passkey authentication successful')

    return user
  }

  /**
   * Try to validate a JWT access token
   * @param {string} bearer JWT token to validate
   * @returns {object|null} Decoded token payload or null if invalid
   */
  static validateJwtToken (bearer) {
    try {
      if (!bearer) {
        return null
      }

      // JWT tokens have 3 parts: header.payload.signature
      const tokenParts = bearer.split('.')
      if (tokenParts.length !== expectedJwtParts) {
        return null
      }

      const decoded = jwt.verify(bearer, config.jwt.secret, { algorithm: 'HS256' })

      // Validate required JWT claims
      if (!decoded.sub || !decoded.aud || !decoded.exp || !decoded.iat) {
        return null
      }

      return decoded
    } catch {
      // JWT validation failed
      return null
    }
  }

  /**
   * Perform Bearer authentication with an access token (supports both opaque tokens and JWTs)
   * @param {object} arg function arguments object
   * @param {string} arg.bearer the bearer access token to authenticate
   * @returns {Promise<boolean|{scope: *, user: db.Model}>} A promise returning the authenticated user object
   */
  static async bearerAuthenticate ({ bearer }) {
    // First try JWT validation
    const jwtPayload = Authentication.validateJwtToken(bearer)
    if (jwtPayload) {
      // This is a valid JWT token
      const user = await User.findOne({
        where: {
          id: jwtPayload.sub,
          suspended: null,
          status: 'active',
        },
      })

      if (!user) {
        return false
      }

      if (user.isSuspended()) {
        throw new GoneAPIError({})
      }

      // Extract scopes from JWT (if present) or use default scope
      const scope = jwtPayload.scope ? jwtPayload.scope.split(' ') : ['*']

      logMetric('authentication_success', {
        _auth_method: 'jwt_bearer',
        _user_id: user.id,
        _client_id: jwtPayload.aud,
        _scopes: scope.join(','),
      }, 'JWT bearer authentication successful')

      return {
        user,
        scope,
        clientId: jwtPayload.aud,
      }
    }

    // Fallback to database token lookup (existing functionality)
    const token = await Token.findOne({ where: { value: bearer } })
    if (!token) {
      logMetric('authentication_failure', {
        _auth_method: 'bearer_token',
        _failure_reason: 'token_not_found',
      }, 'Bearer token authentication failed - token not found')
      return false
    }
    const userInstance = await User.findOne({
      where: { id: token.userId },
    })

    if (userInstance && userInstance.isSuspended()) {
      throw new GoneAPIError({})
    }

    const user = await User.findOne({
      where: {
        id: token.userId,
        suspended: null,
        status: 'active',
      },
    })

    if (user) {
      // Throttle lastAccess updates to once per minute
      const accessIntervalMs = 60 * 1000
      const shouldUpdate = !token.lastAccess
        || (Date.now() - new Date(token.lastAccess).getTime()) > accessIntervalMs
      if (shouldUpdate) {
        token.update({ lastAccess: new Date() }).catch(() => {})
      }

      logMetric('authentication_success', {
        _auth_method: 'bearer_token',
        _user_id: user.id,
        _client_id: token.clientId,
        _scopes: token.scope.join(','),
      }, 'Bearer token authentication successful')
    }

    return {
      user,
      scope: token.scope,
      clientId: token.clientId,
      tokenValue: token.value,
    }
  }

  /**
   * Assert that client authentication is provided in the request
   * @param {object} obj function arguments object
   * @param {Context} obj.connection connection object
   * @returns {Promise<Client>}  OAuth client
   */
  static requireClientAuthentication ({ connection }) {
    const [basicClientId, basicClientSecret] = getBasicAuth(connection)
    if (basicClientId) {
      return Authentication.authenticateBasicClient({
        clientId: basicClientId,
        secret: basicClientSecret,
      })
    }
    if (connection.data && connection.data.client_id) {
      return Authentication.clientAuthenticate({
        clientId: connection.data.client_id,
        secret: connection.data.client_secret,
      })
    }
    throw new UnauthorizedAPIError({})
  }

  /**
   * Perform basic user authentication
   * @param {object} obj function arguments object
   * @param {Context} obj.connection connection object
   * @returns {Promise<db.User|undefined>} authenticated user
   */
  static basicUserAuthentication ({ connection }) {
    const [email, password, code] = getBasicAuth(connection)
    if (email && password) {
      return Authentication.passwordAuthenticate({ email, password, code })
    }
    return undefined
  }

  /**
   * Authenticate an OAuth client using client id and client secret
   * @param {object} arg function arguments object
   * @param {string} arg.clientId the ID of the OAuth client to authenticate
   * @param {string} arg.secret the secret key of the OAuth client to authenticate
   * @returns {Promise<Client>} A promise returning the authenticated OAuth client object
   */
  static async clientAuthenticate ({ clientId, secret }) {
    UUIDPattern.lastIndex = 0
    if (!clientId || !UUIDPattern.test(clientId)) {
      return undefined
    }
    const client = await Client.scope('user').findByPk(clientId)
    if (!client) {
      return undefined
    }

    const authorised = await verifyPassword(secret, client.secret)
    if (authorised) {
      if (client.user.isSuspended()) {
        throw new GoneAPIError({})
      }

      if (getHashRounds(client.secret) > constants.bcryptRoundsCount) {
        const newRoundSecret = await hashPassword(secret, constants.bcryptRoundsCount)
        Client.update({
          secret: newRoundSecret,
        }, {
          where: { id: client.id },
        })
      }
      return client
    }
    throw new UnauthorizedAPIError({})
  }

  /**
   * Attempt to authenticate an OAuth client, returning undefined instead of throwing
   * when the credentials are rejected, so an alternate credential encoding can be tried.
   * @param {object} arg function arguments object
   * @param {string} arg.clientId the ID of the OAuth client to authenticate
   * @param {string} arg.secret the secret key of the OAuth client to authenticate
   * @returns {Promise<Client|undefined>} the authenticated client, or undefined if rejected
   */
  static async tryClientAuthenticate ({ clientId, secret }) {
    try {
      return await Authentication.clientAuthenticate({ clientId, secret })
    } catch (error) {
      if (error instanceof UnauthorizedAPIError) {
        return undefined
      }
      throw error
    }
  }

  /**
   * Authenticate an OAuth client presented via HTTP Basic auth (client_secret_basic).
   * RFC 6749 section 2.3.1 requires the client id and secret to be form-urlencoded before
   * Base64 encoding, so reserved characters (e.g. = @ % }) arrive percent-encoded. The
   * decoded credentials are tried first, falling back to the raw values so both
   * spec-compliant clients and any legacy raw-Basic clients continue to authenticate.
   * @param {object} arg function arguments object
   * @param {string} arg.clientId the raw client id from the Authorization header
   * @param {string} arg.secret the raw client secret from the Authorization header
   * @returns {Promise<Client>} the authenticated OAuth client
   */
  static async authenticateBasicClient ({ clientId, secret }) {
    const decodedId = decodeClientCredential(clientId)
    const decodedSecret = decodeClientCredential(secret)
    if (decodedId !== clientId || decodedSecret !== secret) {
      const decodedClient = await Authentication.tryClientAuthenticate({
        clientId: decodedId,
        secret: decodedSecret,
      })
      if (decodedClient) {
        return decodedClient
      }
    }
    return Authentication.clientAuthenticate({ clientId, secret })
  }

  /**
   * Perform all available authentication flows on a request context
   * @param {object} arg function arguments object
   * @param {Context} arg.connection a request connection context
   * @returns {Promise<boolean>} true if the request was successfully authenticated, false if not
   */
  static async authenticate ({ connection }) {
    const basicUser = await Authentication.basicUserAuthentication({ connection })
    if (basicUser) {
      connection.state.user = basicUser
      connection.state.basicAuth = true
      return true
    }

    if (connection.session.userId) {
      const user = await User.findOne({
        where: { id: connection.session.userId, suspended: null, status: 'active' },
      })
      if (user) {
        connection.state.user = user
        return true
      }
    }

    const bearerToken = getBearerToken(connection)
    if (bearerToken) {
      const bearerCheck = await Authentication.bearerAuthenticate({ bearer: bearerToken })
      if (bearerCheck) {
        connection.state.user = bearerCheck.user
        connection.state.scope = bearerCheck.scope
        connection.state.clientId = bearerCheck.clientId
        connection.state.currentTokenValue = bearerCheck.tokenValue
        return true
      }
    }
    return false
  }

  /**
   * Koa Middleware to require that a user be authenticated to continue the request
   * @param {Context} ctx a request context
   * @param {Function} next the next middleware or route
   * @returns {Promise<void>}
   */
  static isAuthenticated (ctx, next) {
    if (ctx.state.user) {
      return next()
    }
    throw new UnauthorizedAPIError({})
  }

  /**
   * Koa Middleware to require that an OAuth client be authenticated to continue the request
   * @param {Context} ctx a request context
   * @param {Function} next the next middleware or route
   * @returns {Promise<void>}
   */
  static async isClientAuthenticated (ctx, next) {
    const client = await Authentication.requireClientAuthentication({ connection: ctx })
    ctx.state.client = client
    ctx.state.user = client

    return next()
  }

  /**
   * Perform this request on behalf of another user, requires admin permission
   * @param {object} arg function arguments object
   * @param {Context} arg.ctx request context
   * @param {string} arg.representing user id or nickname
   * @returns {Promise<void>} resolves a promise on completion
   */
  static async authenticateRepresenting ({ ctx, representing }) {
    if (!Permission.granted({ permissions: ['users.write'], connection: ctx })) {
      throw new ForbiddenAPIError({ parameter: 'representing' })
    }

    let representedUser
    if (new UUID(constants.uuidVersion).parse(representing)) {
      representedUser = await User.findOne({
        where: {
          id: representing,
        },
      })
    } else {
      const nickname = await Anope.findNickname(representing)
      if (!nickname) {
        return false
      }

      representedUser = nickname.user
    }


    if (!representedUser) {
      return false
    }

    if (representedUser.isSuspended()) {
      throw new GoneAPIError({ parameter: 'representing' })
    }

    ctx.state.user = representedUser
    return true
  }
}



/**
 * Retrieve bearer token from a request object
 * @param {Context} ctx the request object to retrieve a bearer token from
 * @returns {*} A string with the bearer token or null if none was found.
 */
function getBearerToken (ctx) {
  if (ctx.query.bearer) {
    return ctx.query.bearer
  }
  if (ctx.get('Authorization')) {
    const authorizationHeader = ctx.get('Authorization')
    if (authorizationHeader.startsWith('Bearer ') && authorizationHeader.length > bearerTokenHeaderOffset) {
      return authorizationHeader.substring(bearerTokenHeaderOffset)
    }
  }
  return undefined
}

/**
 * Decode a client credential component supplied via HTTP Basic authentication.
 * Per RFC 6749 section 2.3.1, client_secret_basic clients form-urlencode the client id and
 * secret before Base64 encoding, so reserved characters arrive percent-encoded. Returns the
 * decoded value, falling back to the original for non-encoded or malformed input.
 * @param {string} value the raw credential component
 * @returns {string} the decoded credential component
 */
function decodeClientCredential (value) {
  if (typeof value !== 'string') {
    return value
  }
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Get basic auth credentials from a request object
 * @param {Context} ctx the request object to retrieve basic auth credentials from
 * @returns {Array} An array containing the username, password, and optional 2FA code, or an empty array if none was found.
 */
export function getBasicAuth (ctx) {
  const authorizationHeader = ctx.get('Authorization')
  if (authorizationHeader.startsWith('Basic ') && authorizationHeader.length > basicAuthHeaderOffset) {
    const authString = Buffer.from(authorizationHeader.substring(basicAuthHeaderOffset), 'base64').toString('utf8')
    return authString.split(':')
  }
  return []
}

export default Authentication
