'use strict'

const config = require('../../../config')
const stripe = require('stripe')(config.stripe.token)
const { OrdersPresenter } = require('../../classes/Presenters')
const Permission = require('../../permission')
const Error = require('../../errors')

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
      if (ctx.session.currentTransaction !== ctx.params.id && !Permission.granted(['order.read'], ctx.state.user, ctx.state.scope)) {
        throw Permission.permissionError(['order.read'])
      }

      let order = await stripe.orders.retrieve(ctx.params.id)
      return OrdersPresenter.render(order)
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    try {
      let order = await stripe.orders.create(ctx.data)

      ctx.session.currentTransaction = order.id
      return OrdersPresenter.render(order)
    } catch (error) {
      throw Error.template('payment_required', error)
    }
  }

  static async update (ctx) {
    if (ctx.params.id) {
      if (ctx.session.currentTransaction !== ctx.params.id && !Permission.granted(['order.write'], ctx.state.user, ctx.state.scope)) {
        throw Permission.permissionError(['order.write'])
      }

      try {
        let order = await stripe.orders.update(ctx.params.id, ctx.data)

        return OrdersPresenter.render(order)
      } catch (error) {
        throw Error.template('payment_required', error)
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async pay (ctx) {
    if (ctx.params.id) {
      if (ctx.session.currentTransaction !== ctx.params.id && !Permission.granted(['order.write'], ctx.state.user, ctx.state.scope)) {
        throw Permission.permissionError(['order.write'])
      }

      try {
        let order = await stripe.orders.pay(ctx.params.id, ctx.data)

        return OrdersPresenter.render(order)
      } catch (error) {
        throw Error.template('payment_required', error)
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }
}

module.exports = Orders
