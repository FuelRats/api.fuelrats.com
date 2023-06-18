import apn from 'apn'
import workerpool from 'workerpool'
import { UnprocessableEntityAPIError } from '../classes/APIError'
import config from '../config'
import { ApplePushSubscription, WebPushSubscription } from '../db'
import API, {
  POST,
  authenticated,
  permissions,
} from './API'

export const webPushPool = workerpool.pool('./dist/workers/web-push.mjs')
export const apnProvider = config.apn.key ? new apn.Provider(config.apn) : undefined

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
  @POST('/apn')
  @authenticated
  async subscribeAPN (ctx) {
    const { deviceToken } = ctx.data
    if (!deviceToken) {
      throw new UnprocessableEntityAPIError({ pointer: 'deviceToken' })
    }

    await ApplePushSubscription.create({
      deviceToken,
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
    const subscriptions = WebPushSubscription.findAll({})
    webPushPool.exec('webPushBroadcast', [subscriptions, ctx.data])
    if (apnProvider) {
      const apnSubscriptions = await ApplePushSubscription.findAll({})
      const deviceTokens = apnSubscriptions.map((sub) => {
        return sub.deviceToken
      })

      const notification = new apn.Notification({
        'content-available': 1,
        sound: 'Ping.aiff',
        category: 'message',
        payload: ctx.data,
      })
      await apnProvider.send(notification, deviceTokens)
    }
  }
}
