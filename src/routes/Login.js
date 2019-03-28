import Authentication from '../classes/Authentication'
import { UnauthorizedAPIError } from '../classes/APIError'
import API, {
  GET,
  POST,
  required
} from '../classes/API'
import UserView from '../views/User'
import DatabaseQuery from '../query2/Database'
import DatabaseDocument from '../Documents/Database'

export default class Login extends API {
  @POST('/login')
  @required('email', 'password')
  async login (ctx) {
    const { email, password } = ctx.data
    const user = await Authentication.passwordAuthenticate({ email, password })
    if (!user) {
      throw new UnauthorizedAPIError({})
    }

    ctx.session.userId = user.id
    ctx.status = 200
    if (ctx.session.redirect) {
      const redirectUrl = ctx.session.redirect
      ctx.session.redirect = undefined
      ctx.redirect(redirectUrl)
    }

    const userQuery = new DatabaseQuery({ params: { id: user.id }, connection: ctx })
    return new DatabaseDocument({ query: userQuery, result: user, type: UserView })
  }

  @GET('/logout')
  logout (ctx) {
    if (!ctx.state.user) {
      throw new UnauthorizedAPIError({})
    }

    ctx.session.userId = null
    return null
  }
}
