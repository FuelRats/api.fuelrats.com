'use strict'

const config = require('../../../config')
const stripe = require('stripe')(config.stripe.token)
const { OrdersPresenter } = require('../../classes/Presenters')

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

  static async findById (ctx) {
    if (ctx.params.id) {
      let order = await stripe.orders.retrieve(ctx.params.id)

      return OrdersPresenter.render(order)
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    let order = await stripe.orders.create(ctx.data)

    return OrdersPresenter.render(order)
  }

  static async update (ctx) {
    if (ctx.params.id) {
      let order = await stripe.orders.update(ctx.params.id, ctx.data)

      return OrdersPresenter.render(order)
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }
}

module.exports = Orders
