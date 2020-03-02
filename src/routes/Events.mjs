import {
  BadRequestAPIError,
  ConflictAPIError,
  ForbiddenAPIError,
  NotFoundAPIError,
  UnprocessableEntityAPIError,
} from '../classes/APIError'
import StatusCode from '../classes/StatusCode'
import WebSocket, { websocket } from '../classes/WebSocket'
import { Client } from '../db'
import API, {
  authenticated,
  POST,
} from './API'

/**
 * WebSocket event subscription endpoint
 */
export default class Events extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'events'
  }

  /**
   * Subscribe to a list of websocket events
   * @endpoint
   */
  @websocket('events', 'subscribe')
  @authenticated
  subscribe (ctx) {
    const { events } = ctx.query

    if (!Array.isArray(events)) {
      throw new UnprocessableEntityAPIError({
        parameter: 'events',
      })
    }

    const existingSubscription = events.some((event) => {
      return ctx.client.subscriptions.includes(event)
    })
    if (existingSubscription) {
      throw new ConflictAPIError({ parameter: 'event' })
    }

    ctx.client.subscriptions.push(...events)
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Unsubscribe from a list of websocket events
   * @endpoint
   */
  @websocket('events', 'unsubscribe')
  @authenticated
  unsubscribe (ctx) {
    const { events } = ctx.query()

    if (!Array.isArray(events)) {
      throw new UnprocessableEntityAPIError({
        parameter: 'events',
      })
    }

    const isSubscribed = events.every((event) => {
      return ctx.client.subscriptions.includes(event)
    })

    if (!isSubscribed) {
      throw new NotFoundAPIError({ parameter: 'events' })
    }

    ctx.client.subscriptions = ctx.client.subscriptions.filter((subscription) => {
      return events.includes(subscription) === false
    })
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Broadcast a WebSocket event
   * @endpoint
   */
  @POST('/events/:event')
  @websocket('events', 'broadcast')
  @authenticated
  async broadcast (ctx) {
    let { event } = ctx.query
    event = event.toLowerCase()

    const [namespace] = event.split('.')
    if (namespace === 'fuelrats') {
      throw new ForbiddenAPIError({ parameter: 'event' })
    }

    const client = await Client.findOne({
      where: {
        id: ctx.state.clientId,
      },
    })

    if (!client) {
      throw new BadRequestAPIError({
        parameter: 'event',
      })
    }

    if (!client.namespaces.includes(namespace)) {
      throw new ForbiddenAPIError({
        parameter: 'event',
      })
    }

    const { data } = ctx

    WebSocket.instance.onBroadcast({
      event,
      sender: ctx.state.user.id,
      data,
    })

    ctx.response.status = StatusCode.noContent
    return true
  }
}
