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
    let token = await Token.findOne({ where: { value: accessToken } })
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

  static async clientAuthenticate (ctx, next) {
    let client = await Client.findById(username)
    if (!client) {
      next(null, false)
    }

    try {
      let result = await bcrypt.compare(secret, client.secret)
      if (result === false) {
        next(null, false)
      } else {
        next(null, client)
      }
    } catch (err) {
      next(null, err)
    }
  }

  static async authenticate (ctx, next) {
    if (ctx.session.userId) {
      let user = await User.findOne({where: { id: ctx.session.userId }})
      if (user) {
        ctx.user = user
        return next()
      }
    }

    await next()
  }
}

module.exports = Authentication