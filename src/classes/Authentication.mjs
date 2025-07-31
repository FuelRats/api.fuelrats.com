import bcrypt from 'bcrypt'
import { authenticator as totp } from 'otplib'
import UUID from 'pure-uuid'
import * as constants from '../constants'
import {
  User, Token, Client, Reset, Authenticator, Passkey, db,
} from '../db'

import Anope from './Anope'
import config from '../config'
import {
  AuthenticatorRequiredAPIError,
  GoneAPIError,
  UnauthorizedAPIError,
  ResetRequiredAPIError,
  ForbiddenAPIError,
} from './APIError'
import { Context } from './Context'
import Permission from './Permission'

const bearerTokenHeaderOffset = 7
const basicAuthHeaderOffset = 6

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

    const result = await bcrypt.compare(password, user.password)
    if (result === false) {
      return undefined
    }
    if (user.isSuspended() === true) {
      throw new GoneAPIError({ pointer: '/data/attributes/email' })
    }

    if (bcrypt.getRounds(user.password) > constants.bcryptRoundsCount) {
      const newRoundPassword = await bcrypt.hash(password, constants.bcryptRoundsCount)
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

      let isValidCode = false
      try {
        isValidCode = totp.check(code, authenticator.secret)
      } catch {
        isValidCode = false
      }

      if (!isValidCode) {
        throw new AuthenticatorRequiredAPIError({
          pointer: '/data/attributes/code',
        })
      }
    }

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
    let verification = null
    try {
      verification = await verifyAuthenticationResponse({
        response: passkeyResponse,
        expectedChallenge,
        expectedOrigin: config.server.externalUrl,
        expectedRPID: new URL(config.server.externalUrl).hostname,
        authenticator: {
          credentialID: Buffer.from(passkey.credentialId, 'base64url'),
          credentialPublicKey: Buffer.from(passkey.publicKey, 'base64url'),
          counter: passkey.counter,
        },
      })
    } catch (error) {
      return undefined
    }

    if (!verification.verified) {
      return undefined
    }

    // Update passkey counter
    await passkey.update({
      counter: verification.authenticationInfo.newCounter,
    })

    return user
  }

  /**
   * Perform Bearer authentication with an access token
   * @param {object} arg function arguments object
   * @param {string} arg.bearer the bearer access token to authenticate
   * @returns {Promise<boolean|{scope: *, user: db.Model}>} A promise returning the authenticated user object
   */
  static async bearerAuthenticate ({ bearer }) {
    const token = await Token.findOne({ where: { value: bearer } })
    if (!token) {
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
    return {
      user,
      scope: token.scope,
      clientId: token.clientId,
    }
  }

  /**
   * Assert that client authentication is provided in the request
   * @param {object} obj function arguments object
   * @param {Context} obj.connection connection object
   * @returns {Promise<Client>}  OAuth client
   */
  static requireClientAuthentication ({ connection }) {
    let [clientId, clientSecret] = getBasicAuth(connection)
    if (!clientId && connection.data) {
      clientId = connection.data.client_id
      clientSecret = connection.data.client_secret
    }
    if (clientId) {
      return Authentication.clientAuthenticate({ clientId, secret: clientSecret })
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
    const client = await Client.scope('user').findByPk(clientId)
    if (!client) {
      return undefined
    }

    const authorised = await bcrypt.compare(secret, client.secret)
    if (authorised) {
      if (client.user.isSuspended()) {
        throw new GoneAPIError({})
      }

      if (bcrypt.getRounds(client.secret) > constants.bcryptRoundsCount) {
        const newRoundSecret = await bcrypt.hash(secret, constants.bcryptRoundsCount)
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
      const user = await User.findOne({ where: { id: connection.session.userId } })
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

    let representedUser = undefined
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
