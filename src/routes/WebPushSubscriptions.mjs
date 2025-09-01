import workerpool from 'workerpool'
import { UnprocessableEntityAPIError } from '../classes/APIError'
import { WebPushSubscription } from '../db'
import API, {
  POST,
  authenticated,
  permissions,
} from './API'

export const webPushPool = workerpool.pool('./dist/workers/web-push.mjs')

/**
 * Class managing password reset endpoints
 */
export default class WebPushSubscriptions extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'web-push'
  }

  /**
   * Subscribe to web push
   * @endpoint
   */
  @POST('/web-push')
  @authenticated
  async subscribeWeb (ctx) {
    const {
      endpoint,
      expirationTime,
      keys: { auth, p256dh },
      pc = true,
      xb = true,
      ps = true,
      odyssey = true,
    } = ctx.data
    if (!endpoint) {
      throw new UnprocessableEntityAPIError({ pointer: 'endpoint' })
    }

    if (!auth) {
      throw new UnprocessableEntityAPIError({ pointer: 'keys/auth' })
    }

    if (!p256dh) {
      throw new UnprocessableEntityAPIError({ pointer: 'keys/p256dh' })
    }

    await WebPushSubscription.create({
      endpoint,
      expirationTime,
      auth,
      p256dh,
      pc,
      xb,
      ps,
      odyssey,
      userId: ctx.state.user.id,
    })
    return true
  }


  /**
   * @endpoint
   */
  @POST('/alerts')
  @authenticated
  @permissions('rescues.write')
  async alert (ctx) {
    const subscriptions = await WebPushSubscription.findAll({})
    webPushPool.exec('webPushBroadcast', [subscriptions, ctx.data])
    return true
  }
}
