import Authentication from './auth'
import { UnauthorizedAPIError } from '../APIError'
import APIEndpoint, {
  POST,
  required
} from '../APIEndpoint'

export default class Login extends APIEndpoint {
  @POST('/login')
  @required('email', 'password')
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