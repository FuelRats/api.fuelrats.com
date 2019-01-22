import Authentication from '../classes/Authentication'
import { UnauthorizedAPIError } from '../classes/APIError'
import API, {
  GET,
  POST,
  required
} from '../classes/API'
import Query from '../query2'
import { User } from '../db'
import Document from '../Documents'
import UserView from '../views/User'

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
      ctx.session.redirect = null
      ctx.redirect(redirectUrl)
    }
    const userQuery = new Query({ params: {
      id: user.id
    }, connection: ctx })
    const result = await User.findAndCountAll(userQuery.toSequelize)
    return new Document({ objects: result.rows, type: UserView, meta: API.meta(result, userQuery) })
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
