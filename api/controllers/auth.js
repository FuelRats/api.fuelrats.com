'use strict'
const { User, Rat, db, Token, Client } = require('../db')
const Error = require('../errors')
const bcrypt = require('bcrypt')
const { UsersPresenter, ClientsPresenter } = require('../classes/Presenters')
let config = require('../../config')

const bearerTokenHeaderOffset = 7
const basicAuthHeaderOffset = 6
const BCRYPT_ROUNDS_COUNT = 12

class Authentication {
  static async passwordAuthenticate (email, password) {
    if (!email || !password) {
      return null
    }

    let user = await User.scope('internal').findOne({where: {email: {$iLike: email}}})
    if (!user) {
      return null
    }

    let result = await bcrypt.compare(password, user.password)
    if (result === false) {
      return null
    } else {
      if (user.isSuspended() === true) {
        throw Error.template('suspended')
      }

      if (bcrypt.getRounds(user.password) > BCRYPT_ROUNDS_COUNT) {
        let newRoundPassword = await bcrypt.hash(password, BCRYPT_ROUNDS_COUNT)
        User.update({
          password: newRoundPassword
        }, {
          where: { id: user.id }
        })
      }

      return UsersPresenter.render(user, {})
    }
  }

  static async bearerAuthenticate (bearer) {
    let token = await Token.findOne({ where: { value: bearer } })
    if (!token) {
      return false
    }
    let userInstance = await User.scope('internal').findOne({
      where: { id: token.userId },
      attributes: {
        include: [
          [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
          'nicknames'
        ]
      },
      include: [
        {
          model: Rat,
          as: 'rats',
          required: false
        }
      ]
    })

    if (userInstance && userInstance.isSuspended()) {
      throw Error.template('suspended')
    }

    let user = UsersPresenter.render(userInstance, {})
    return {
      user: user,
      scope: token.scope
    }
  }

  static async clientAuthenticate (clientId, secret) {
    let client = await Client.findById(clientId)
    if (!client) {
      return null
    }

    let authorised = await bcrypt.compare(secret, client.secret)
    if (authorised) {
      if (bcrypt.getRounds(client.secret) > BCRYPT_ROUNDS_COUNT) {
        let newRoundSecret = await bcrypt.hash(secret, BCRYPT_ROUNDS_COUNT)
        Client.update({
          secret: newRoundSecret
        }, {
          where: { id: client.id }
        })
      }
      return ClientsPresenter.render(client, {})
    }
    return false
  }

  static async authenticate (ctx) {
    let [ clientId, clientSecret ] = getBasicAuth(ctx)
    if (clientId) {
      ctx.state.client = await Authentication.clientAuthenticate(clientId, clientSecret)
      ctx.state.user = ctx.state.client
    }

    if (ctx.session.userId) {
      let user = await User.scope('internal').findOne({where: { id: ctx.session.userId }})
      if (user) {
        ctx.state.user = UsersPresenter.render(user, {})
        return true
      }
    }

    let bearerToken = getBearerToken(ctx)
    if (bearerToken) {
      let bearerCheck = await Authentication.bearerAuthenticate(bearerToken)
      if (bearerCheck) {
        ctx.state.user = bearerCheck.user
        ctx.state.scope = bearerCheck.scope
        return true
      }
    }
    return false
  }

  static isAuthenticated (ctx, next) {
    if (ctx.state.user) {
      return next()
    } else {
      throw Error.template('not_authenticated')
    }
  }

  static isWhitelisted (ctx, next) {
    if (config.whitelist.includes(ctx.inet)) {
      return next()
    } else {
      throw Error.template('webhook_unauthorised')
    }
  }

  static async isClientAuthenticated (ctx, next) {
    if (ctx.state.client) {
      await next()
    } else {
      throw Error.template('client_unauthorised')
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
    let authorizationHeader = ctx.get('Authorization')
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
  let authorizationHeader = ctx.get('Authorization')
  if (authorizationHeader.startsWith('Basic ') && authorizationHeader.length > basicAuthHeaderOffset) {
    let authString = Buffer.from(authorizationHeader.substring(basicAuthHeaderOffset), 'base64').toString('utf8')
    return authString.split(':')
  }
  return []
}

module.exports = Authentication