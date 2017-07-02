'use strict'
const Action = require('../db').Action
const Authentication = require('./auth')
const Error = require('../errors')

class Login {
  static async login (ctx, next) {
    let user = await Authentication.passwordAuthenticate(ctx.data.email, ctx.data.password)
    if (!user) {
      throw Error.template('not_authenticated', 'Authentication failed')
    }

    ctx.session.userId = user.data.id
    ctx.status = 200
    return user
  }
}

module.exports = Login