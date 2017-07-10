'use strict'
const User = require('../db').User
const Rat = require('../db').Rat
const db = require('../db').db
const Token = require('../db').Token
const Client = require('../db').Client
const Error = require('../errors')
const bcrypt = require('bcrypt')
const Permission = require('../permission')
const UsersPresenter = require('../classes/Presenters').UsersPresenter
const ClientsPresenter = require('../classes/Presenters').ClientsPresenter

const bearerTokenHeaderOffset = 7
const basicAuthHeaderOffset = 6

class Authentication {
  static async passwordAuthenticate (email, password) {
    if (!email || !password) {
      return null
    }

    let user = await User.findOne({where: {email: {$iLike: email}}})
    if (!user) {
      return null
    }

    let result = await bcrypt.compare(password, user.password)
    if (result === false) {
      return null
    } else {
      return UsersPresenter.render(user, {})
    }
  }

  static async bearerAuthenticate (bearer) {
    let token = await Token.findOne({ where: { value: bearer } })
    if (!token) {
      return false
    }
    let userInstance = await User.findOne({
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
      return ClientsPresenter.render(client, {})
    }
    return false
  }

  static async authenticate (ctx, next) {
    let [ clientId, clientSecret ] = getBasicAuth(ctx)
    if (clientId) {
      ctx.state.client = await Authentication.clientAuthenticate(clientId, clientSecret)
      ctx.state.user = ctx.state.client
      return next()
    }

    if (ctx.session.userId) {
      let user = await User.findOne({where: { id: ctx.session.userId }})
      if (user) {
        ctx.state.user = UsersPresenter.render(user, {})
        return next()
      }
    }

    let bearerToken = getBearerToken(ctx)
    if (bearerToken) {
      let bearerCheck = await Authentication.bearerAuthenticate(bearerToken)
      if (bearerCheck) {
        ctx.state.user = bearerCheck.user
        ctx.state.scope = bearerCheck.scope
        return next()
      }
    }
    await next()
  }

  static isAuthenticated (ctx, next) {
    if (ctx.state.user) {
      return next()
    } else {
      throw Error.template('not_authenticated')
    }
  }

  static isAuthenticatedRedirect (ctx, next) {
    if (ctx.state.user) {
      return next()
    } else {
      ctx.session.redirect = ctx.request.path
      ctx.redirect('/login')
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

function getBasicAuth (ctx) {
  let authorizationHeader = ctx.get('Authorization')
  if (authorizationHeader.startsWith('Basic ') && authorizationHeader.length > basicAuthHeaderOffset) {
    let authString = Buffer.from(authorizationHeader.substring(basicAuthHeaderOffset), 'base64').toString('utf8')
    return authString.split(':')
  }
  return []
}

module.exports = Authentication