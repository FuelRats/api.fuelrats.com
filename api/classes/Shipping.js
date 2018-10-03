'use strict'
const config = require('../../config')
const { Dropbox } = require('dropbox')
const moment = require('moment')
require('isomorphic-fetch')

const shippingFields = [
  'reference',
  'date',
  'total',
  'currency',

  'name',
  'phone',
  'email',
  'address1',
  'address2',
  'city',
  'postcode',
  'region',
  'country'
]

class Shipping {
  constructor () {
    this.dropbox = new Dropbox({ accessToken: config.dropbox.token })
  }

  async uploadLabel (order) {
    let entry = Shipping.getCsvFriendlyOrder(order)
    let csv = Shipping.generateCsv(shippingFields, [entry])

    await this.dropbox.filesUpload({
      path: `${config.dropbox.path}/${order.id}.csv`,
      contents: csv
    })
  }

  static getCsvFriendlyOrder (order) {
    const date = moment.unix(order.created).format('DD/MM/YY')
    const amount = order.amount / 100

    return {
      reference: order.id,
      date,
      total: amount,
      currency: order.currency,
      name: order.shipping.name,
      phone: order.shipping.phone,
      email: order.email,
      address1: order.shipping.address.line1,
      address2: order.shipping.address.line2,
      city: order.shipping.address.city,
      postcode: order.shipping.address.postal_code,
      region: order.shipping.address.state,
      country: order.shipping.address.country
    }
  }

  static generateCsv (fields, objects) {
    let lines = objects.map((object) => {
      return fields.map((field) => {
        let value = object[field]
        return value ? `"${value}"` : ''
      }).join(',')
    })
    let headers = fields.join(',')

    return `${headers}\n${lines.join('\n')}`
  }
}

module.exports = Shipping
