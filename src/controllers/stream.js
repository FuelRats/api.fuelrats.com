

import { CustomPresenter, ObjectPresenter } from '../classes/Presenters'
import APIEndpoint from '../APIEndpoint'
import { ConflictAPIError } from '../APIError'

class Stream extends APIEndpoint {
  subscribe (ctx) {
    let applicationId = ctx.query.id

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

  unsubscribe (ctx) {
    let applicationId = ctx.query.id

    let subscriptionPosition = ctx.client.subscriptions.indexOf(applicationId)
    ctx.client.subscriptions.splice(subscriptionPosition, 1)

    return Stream.presenter.render(ctx.client.subscriptions.map((subscription) => {
      return {
        id: subscription
      }
    }), {})
  }

  broadcast (ctx) {
    let applicationId = ctx.query.id

    let result = CustomPresenter.render(ctx.data)
    result.meta = {}
    Object.assign(result.meta, ctx.query)
    process.emit('apiBroadcast', applicationId, ctx, result)
    return result
  }

  static get presenter () {
    class SubscriptionsPresenter extends ObjectPresenter {
      id (instance) {
        return instance.id
      }

      attributes (instance) {
        if (instance) {
          return ['id']
        }
        return null
      }
    }
    SubscriptionsPresenter.prototype.type = 'subscriptions'
    return SubscriptionsPresenter
  }
}

module.exports = Stream