
import logger from '../loggly/logger'
import API, {
  IPAuthenticated,
  POST
} from '../classes/API'

export default class AnopeWebhook extends API {
  @POST('/anope')
  @IPAuthenticated
  update (ctx) {
    if (ctx.data.event) {
      switch (ctx.data.event) {
        case 'ns_register':
          logger.info('register', ctx.data.user)
          break

        case 'ns_drop':
          logger.info('drop', ctx.data.user)
          break

        case 'ns_group':
          logger.info('group', ctx.data.user, ctx.data.account)
          break

        default:
          break
      }
    }
    return true
  }
}
