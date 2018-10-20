'use strict'

const config = require('../../../config')
const stripe = require('stripe')(config.stripe.token)
const { OrdersPresenter } = require('../../classes/Presenters')
const Permission = require('../../permission')
const Error = require('../../errors')
const { Orders: Order } = require('../../db')
const stripeWebhook = require('./webhook')

class Orders {
  static async search (ctx) {
    let stripeOrders = await stripe.orders.list(
      ctx.query
    )

    let customOrders = await Order.findAll({
      where: ctx.query
    })

    stripeOrders.data.map((order) => {
      order.returns = order.returns.data
      return order
    })

    stripeOrders.data = stripeOrders.data.concat(customOrders)

    return OrdersPresenter.render(stripeOrders.data, {
      more: stripeOrders.has_more
    })
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      if (ctx.session.currentTransaction !== ctx.params.id && !Permission.granted(['order.read'], ctx.state.user, ctx.state.scope)) {
        throw Permission.permissionError(['order.read'])
      }


      let stripeOrder = null
      if (ctx.params.id.startsWith('or_')) {
        stripeOrder = await stripe.orders.retrieve(ctx.params.id)
      } else {
        stripeOrder = await Order.findById(ctx.params.id)
      }
      return OrdersPresenter.render(stripeOrder)
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

  static manualCreate (ctx) {
    return Order.create(ctx.data)
  }

  static async update (ctx) {
    if (ctx.params.id) {
      if (ctx.session.currentTransaction !== ctx.params.id && !Permission.granted(['order.write'], ctx.state.user, ctx.state.scope)) {
        throw Permission.permissionError(['order.write'])
      }

      try {
        let order = null
        if (ctx.params.id.startsWith('or_')) {
          order = await stripe.orders.update(ctx.params.id, ctx.data)
        } else {
          await Order.update(ctx.data, {
            where: {
              id: ctx.params.id
            }
          })
          order = await Order.findById(ctx.params.id)


          if (ctx.data.status === 'paid') {
            await stripeWebhook.paymentSuccessful({
              data: {
                object: order
              }
            })
          } else if (ctx.data.status === 'fulfilled') {
            await stripeWebhook.orderUpdated({
              data: {
                object: order,
                previous_attributes: {
                  status: 'paid'
                }
              }
            })
          }
        }

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
