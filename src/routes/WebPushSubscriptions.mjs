import { UnprocessableEntityAPIError } from '../classes/APIError'
import { WebPushSubscription } from '../db'
import config from '../config'
import { buildBroadcastPayload } from '../helpers/pushPayload'
import { createWorkerPool } from '../helpers/workerPool'
import API, {
  POST,
  authenticated,
  permissions,
} from './API'

export const webPushPool = createWorkerPool('../workers/web-push.mjs', import.meta.url)

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

    await WebPushSubscription.upsert({
      endpoint,
      expirationTime,
      auth,
      p256dh,
      pc,
      xb,
      ps,
      odyssey,
      userId: ctx.state.user.id,
    }, {
      conflictFields: ['endpoint'],
    })
    return true
  }


  /**
   * @endpoint
   */
  @POST('/alerts')
  @authenticated
  @permissions('twitter.write')
  async alert (ctx) {
    const {
      title, body, icon, tag, data, type,
      TTL, urgency, topic,
    } = ctx.data ?? {}

    if (!title || !body) {
      throw new UnprocessableEntityAPIError({
        pointer: title ? '/body' : '/title',
        detail: 'title and body are required',
      })
    }

    const subscriptions = await WebPushSubscription.findAll({})
    webPushPool.exec({
      subscribers: subscriptions,
      payload: buildBroadcastPayload({ title, body, icon, tag, data, type }),
      vapidConfig: config.webpush,
      options: {
        TTL: TTL ?? 86400, // 24h default for broadcasts
        urgency: urgency ?? 'normal',
        topic,
      },
    })
    return true
  }
}
