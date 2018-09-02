'use strict'

const config = require('../../config')
const stripe = require('stripe')(config.stripe.token)
const { CustomersPresenter } = require('../classes/Presenters')

class Customers {
  static async create (ctx) {
    let customer = await stripe.customers.create(ctx.data)
    return CustomersPresenter.render(customer)
  }
}

module.exports = Customers
