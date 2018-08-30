'use strict'

const config = require('../../config')
const stripe = require('stripe')(config.stripe.token)
const { ProductsPresenter } = require('../classes/Presenters')

class Products {
  static async search (ctx) {
    let products = await stripe.products.list(
      ctx.query
    )

    return ProductsPresenter.render(products.data, {
      more: products.has_more
    })
  }
}

module.exports = Products
