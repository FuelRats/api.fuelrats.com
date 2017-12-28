import Authentication from './auth'
import { UnauthorizedAPIError } from '../APIError'
import APIEndpoint from '../APIEndpoint'

class Login extends APIEndpoint {
  async login (ctx) {
    let user = await Authentication.passwordAuthenticate(ctx.data.email, ctx.data.password)
    if (!user) {
      throw new UnauthorizedAPIError({})
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
}

module.exports = Login