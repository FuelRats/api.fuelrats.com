import Authentication from '../classes/Authentication'
import { UnauthorizedAPIError } from '../classes/APIError'
import API, {
  POST,
  required
} from '../classes/API'

export default class Login extends API {
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