'use strict'

const Error = require('../errors')
const { SubscriptionsPresenter, CustomPresenter } = require('../classes/Presenters')

class Stream {
  static subscribe (ctx) {
    let applicationId = ctx.query.id
    if (!applicationId || applicationId.length === 0) {
      throw Error.template('missing_required_field', 'id')
    }

    if (ctx.client.subscriptions.includes(applicationId)) {
      throw Error.template('already_exists', applicationId)
    }

    ctx.client.subscriptions.push(applicationId)
    return SubscriptionsPresenter.render(ctx.client.subscriptions.map((subscription) => {
      return {
        id: subscription
      }
    }), {})
  }

  static unsubscribe (ctx) {
    let applicationId = ctx.query.id
    if (!applicationId || applicationId.length === 0) {
      throw Error.template('missing_required_field', 'id')
    }

    if (!ctx.client.subscriptions.includes(applicationId)) {
      throw Error.template('invalid_parameter', 'id')
    }

    let subscriptionPosition = ctx.client.subscriptions.indexOf(applicationId)
    ctx.client.subscriptions.splice(subscriptionPosition, 1)

    return SubscriptionsPresenter.render(ctx.client.subscriptions.map((subscription) => {
      return {
        id: subscription
      }
    }), {})
  }

  static broadcast (ctx) {
    let applicationId = ctx.query.id
    if (!applicationId || applicationId.length === 0) {
      throw Error.template('missing_required_field', 'id')
    }

    let { event } = ctx.query
    if (!event || event.length === 0) {
      throw Error.template('missing_required_field', 'event')
    }

    let result = CustomPresenter.render(ctx.data)
    result.meta = {}
    Object.assign(result.meta, ctx.query)
    process.emit('apiBroadcast', applicationId, ctx, result)
    return result
  }
}

module.exports = Stream