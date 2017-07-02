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

const bearerTokenHeaderOffset = 7

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
      throw(false)
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

    return bcrypt.compare(secret, client.secret)
  }

  static async authenticate (ctx, next) {
    if (ctx.session.userId) {
      let user = await User.findOne({where: { id: ctx.session.userId }})
      if (user) {
        ctx.user = user
        return next()
      }
    }

    let bearerToken = getBearerToken(ctx)
    if (bearerToken) {
      let bearerCheck = await Authentication.bearerAuthenticate(bearerToken)
      if (bearerCheck) {
        ctx.user = bearerCheck.user
        ctx.scope = bearerCheck.scope
        return next()
      }
    }
    await next()
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

module.exports = Authentication