import bcrypt from 'bcrypt'
import { User, Rat, Token, Client, Reset } from '../db/index'
import { GoneAPIError, UnauthorizedAPIError, ResetRequiredAPIError } from './APIError'

const bearerTokenHeaderOffset = 7
const basicAuthHeaderOffset = 6

export default class Authentication {
  static async passwordAuthenticate ({ email, password }) {
    if (!email || !password) {
      return null
    }

    const user = await User.findOne({ where: { email: { $iLike: email } } })
    if (!user) {
      return null
    }

    const requiredResets = await Reset.findAll({
      where: {
        userId: user.id,
        required: true
      }
    })

    if (requiredResets.length > 0) {
      throw new ResetRequiredAPIError({
        pointer: '/data/attributes/email'
      })
    }

    const result = await bcrypt.compare(password, user.password)
    if (result === false) {
      return null
    } else {
      if (user.isSuspended() === true) {
        throw new GoneAPIError({ pointer: '/data/attributes/email' })
      }

      if (bcrypt.getRounds(user.password) > global.BCRYPT_ROUNDS_COUNT) {
        const newRoundPassword = await bcrypt.hash(password, global.BCRYPT_ROUNDS_COUNT)
        User.update({
          password: newRoundPassword
        }, {
          where: { id: user.id }
        })
      }
      return User.findOne({ where: { email: { $iLike: email } } })
    }
  }

  static async bearerAuthenticate ({ bearer }) {
    const token = await Token.findOne({ where: { value: bearer } })
    if (!token) {
      return false
    }
    const userInstance = await User.findOne({
      where: { id: token.userId }
    })

    if (userInstance && userInstance.isSuspended()) {
      throw new GoneAPIError({})
    }

    const user = await User.findOne({ where: { id: token.userId } })
    return {
      user,
      scope: token.scope
    }
  }

  static async clientAuthenticate ({ clientId, secret }) {
    const client = await Client.findById(clientId)
    if (!client) {
      return null
    }

    const authorised = await bcrypt.compare(secret, client.secret)
    if (authorised) {
      if (client.user.isSuspended()) {
        throw new GoneAPIError({})
      }

      if (bcrypt.getRounds(client.secret) > global.BCRYPT_ROUNDS_COUNT) {
        const newRoundSecret = await bcrypt.hash(secret, global.BCRYPT_ROUNDS_COUNT)
        Client.update({
          secret: newRoundSecret
        }, {
          where: { id: client.id }
        })
      }
      return client
    }
    throw new UnauthorizedAPIError({})
  }

  static async authenticate ({ connection }) {
    const [clientId, clientSecret] = getBasicAuth(connection)
    if (clientId) {
      connection.state.client = await Authentication.clientAuthenticate({ clientId, clientSecret })
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
      const bearerCheck = await Authentication.bearerAuthenticate(bearerToken)
      if (bearerCheck) {
        connection.state.user = bearerCheck.user
        connection.state.scope = bearerCheck.scope
        return true
      }
    }
    return false
  }

  static isAuthenticated (ctx, next) {
    if (ctx.state.user) {
      return next()
    } else {
      throw new UnauthorizedAPIError({})
    }
  }

  static async isClientAuthenticated (ctx, next) {
    if (ctx.state.client) {
      await next()
    } else {
      throw new UnauthorizedAPIError({})
    }
  }
}

/**
 * Retrieve bearer token from a request object
 * @param ctx the request object to retrieve a bearer token from
 * @returns {*} A string with the bearer token or null if none was found.
 */
function getBearerToken (ctx) {
  if (ctx.query.bearer) {
    return ctx.query.bearer
  } else if (ctx.get('Authorization')) {
    const authorizationHeader = ctx.get('Authorization')
    if (authorizationHeader.startsWith('Bearer ') && authorizationHeader.length > bearerTokenHeaderOffset) {
      return authorizationHeader.substring(bearerTokenHeaderOffset)
    }
  }
  return null
}

/**
 * Get basic auth credentials from a request object
 * @param ctx the requset object to retrieve basic auth credentials from
 * @returns {Array} An array containing the username and password, or an empty array if none was found.
 */
function getBasicAuth (ctx) {
  const authorizationHeader = ctx.get('Authorization')
  if (authorizationHeader.startsWith('Basic ') && authorizationHeader.length > basicAuthHeaderOffset) {
    const authString = Buffer.from(authorizationHeader.substring(basicAuthHeaderOffset), 'base64').toString('utf8')
    return authString.split(':')
  }
  return []
}
