'use strict'

const config = require('../../config')
const stripe = require('stripe')(config.stripe.token)
const { ProductsPresenter } = require('../classes/Presenters')

class Products {
  static async search (ctx) {
    let products = await stripe.products.list(
      ctx.query
    )
    let skus = await stripe.skus.list({ limit: 100 })
    products = products.data.map((product) => {
      product.skus = skus.data.filter((sku) => {
        return sku.product === product.id
      })
      return product
    })

    return ProductsPresenter.render(products, {
      more: products.has_more
    })
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let product = await stripe.products.retrieve(ctx.params.id)
      let skus = await stripe.skus.list({ product: ctx.params.id })
      product.skus = skus.data

      return ProductsPresenter.render(product)
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }
}

module.exports = Products
