import { NotFoundAPIError, UnprocessableEntityAPIError, UnsupportedMediaAPIError } from '../classes/APIError'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { User, WebPushSubscription } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import config from '../config'
import { buildBroadcastPayload } from '../helpers/pushPayload'
import { createWorkerPool } from '../helpers/workerPool'
import DatabaseQuery from '../query/DatabaseQuery'
import { WebPushSubscriptionView } from '../view'
import {
  GET,
  POST,
  PATCH,
  DELETE,
  authenticated,
  permissions,
  WritePermission,
} from './API'
import APIResource from './APIResource'

export const webPushPool = createWorkerPool('../workers/web-push.mjs', import.meta.url)

/**
 * Class managing web push subscription endpoints and alert broadcasting
 */
export default class WebPushSubscriptions extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'web-push-subscriptions'
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
   * Unsubscribe the current device by endpoint. Used by the service worker
   * when the subscription is being removed or replaced.
   * @endpoint
   */
  @DELETE('/web-push')
  @authenticated
  async unsubscribeWeb (ctx) {
    const { endpoint } = ctx.data ?? {}
    if (!endpoint) {
      throw new UnprocessableEntityAPIError({ pointer: 'endpoint' })
    }

    await WebPushSubscription.destroy({
      where: {
        endpoint,
        userId: ctx.state.user.id,
      },
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * List a user's web push subscriptions
   * @endpoint
   */
  @GET('/users/:id/web-push-subscriptions')
  @authenticated
  async list (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireReadPermission({ connection: ctx, entity: user })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await WebPushSubscription.findAndCountAll({
      where: { userId: user.id },
      ...query.searchObject,
    })

    return new DatabaseDocument({ query, result, type: WebPushSubscriptionView })
  }

  /**
   * Update platform/expansion filters on a subscription
   * @endpoint
   */
  @PATCH('/users/:id/web-push-subscriptions/:subscriptionId')
  @authenticated
  async update (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const subscription = await WebPushSubscription.findOne({
      where: { id: ctx.params.subscriptionId, userId: user.id },
    })
    if (!subscription) {
      throw new NotFoundAPIError({ parameter: 'subscriptionId' })
    }

    const attributes = ctx.data?.data?.attributes ?? ctx.data ?? {}
    const { pc, xb, ps, odyssey } = attributes
    const updates = {}
    if (typeof pc === 'boolean') { updates.pc = pc }
    if (typeof xb === 'boolean') { updates.xb = xb }
    if (typeof ps === 'boolean') { updates.ps = ps }
    if (typeof odyssey === 'boolean') { updates.odyssey = odyssey }

    await subscription.update(updates)

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({
      query,
      result: subscription,
      type: WebPushSubscriptionView,
      view: DocumentViewType.individual,
    })
  }

  /**
   * Delete a specific subscription by id
   * @endpoint
   */
  @DELETE('/users/:id/web-push-subscriptions/:subscriptionId')
  @authenticated
  async delete (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const subscription = await WebPushSubscription.findOne({
      where: { id: ctx.params.subscriptionId, userId: user.id },
    })
    if (!subscription) {
      throw new NotFoundAPIError({ parameter: 'subscriptionId' })
    }

    await subscription.destroy()
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Broadcast alert to all subscribers
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

  /**
   * Send an alert to a specific user's devices. Users can send to themselves;
   * otherwise requires `twitter.write` permission.
   * @endpoint
   */
  @POST('/users/:id/alerts')
  @authenticated
  async userAlert (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const isSelf = ctx.state.user.id === user.id
    if (!isSelf && !Permission.granted({ connection: ctx, permissions: ['twitter.write'] })) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

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

    const subscriptions = await WebPushSubscription.findAll({
      where: { userId: user.id },
    })

    webPushPool.exec({
      subscribers: subscriptions,
      payload: buildBroadcastPayload({ title, body, icon, tag, data, type }),
      vapidConfig: config.webpush,
      options: {
        TTL: TTL ?? 3600, // 1h default for user alerts
        urgency: urgency ?? 'normal',
        topic,
      },
    })
    return true
  }

  /**
   * Subscriptions use user-level permissions since they are a user sub-resource
   * @inheritdoc
   */
  hasReadPermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: ['users.read.me', 'users.read'], connection })
    }
    return Permission.granted({ permissions: ['users.read'], connection })
  }

  /**
   * @inheritdoc
   */
  hasWritePermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: ['users.write.me'], connection })
        || Permission.granted({ permissions: ['users.write'], connection })
    }
    return Permission.granted({ permissions: ['users.write'], connection })
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    return (entity.id && ctx.state.user.id === entity.id)
      || (entity.userId && ctx.state.user.id === entity.userId)
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      pc: WritePermission.self,
      xb: WritePermission.self,
      ps: WritePermission.self,
      odyssey: WritePermission.self,
    }
  }

  /**
   * @inheritdoc
   */
  changeRelationship () {
    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {}
  }
}
