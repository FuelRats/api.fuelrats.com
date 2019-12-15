/* eslint-disable */


import API, {
  authenticated
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import { ConflictAPIError } from '../classes/APIError'

export default class Stream extends API {
  get type () {
    return 'streams'
  }

  @websocket('stream', 'subscribe')
  @authenticated
  subscribe (ctx) {
    const applicationId = ctx.query.id

    if (ctx.client.subscriptions.includes(applicationId)) {
      throw new ConflictAPIError({ parameter: 'applicationId' })
    }

    ctx.client.subscriptions.push(applicationId)
    return Stream.presenter.render(ctx.client.subscriptions.map((subscription) => {
      return {
        id: subscription
      }
    }), {})
  }

  @websocket('stream', 'unsubscribe')
  unsubscribe (ctx) {
    const applicationId = ctx.query.id

    const subscriptionPosition = ctx.client.subscriptions.indexOf(applicationId)
    ctx.client.subscriptions.splice(subscriptionPosition, 1)

    return Stream.presenter.render(ctx.client.subscriptions.map((subscription) => {
      return {
        id: subscription
      }
    }), {})
  }

  @websocket('stream', 'broadcast')
  @authenticated
  broadcast (ctx) {
    const applicationId = ctx.query.id

    let result = {}
    result.meta = {}
    Object.assign(result.meta, ctx.query)
    process.emit('apiBroadcast', applicationId, ctx, result)
    return result
  }
}
