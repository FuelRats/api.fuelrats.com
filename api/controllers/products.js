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

  static async findById (ctx) {
    if (ctx.params.id) {
      let product = await stripe.products.retrieve(ctx.params.id)
      return ProductsPresenter.render(product)
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }
}

module.exports = Products
