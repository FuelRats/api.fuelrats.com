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
    if (ctx.session.redirect) {
      let redirectUrl = ctx.session.redirect
      ctx.session.redirect = null
      ctx.redirect(redirectUrl)
    }
    return user
  }

  static async display (ctx) {
    await ctx.render('login')
  }
}

module.exports = Login