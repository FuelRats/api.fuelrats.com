'use strict'

const config = require('../../config')
const stripe = require('stripe')(config.stripe.token)
const { OrdersPresenter } = require('../classes/Presenters')

class Orders {
  static async search (ctx) {
    let orders = await stripe.orders.list(
      ctx.query
    )

    orders.data.map((order) => {
      order.returns = order.returns.data
      return order
    })

    return OrdersPresenter.render(orders.data, {
      more: orders.has_more
    })
  }
}

module.exports = Orders
