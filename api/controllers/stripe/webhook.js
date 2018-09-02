'use strict'

const config = require('../../../config')
const stripe = require('stripe')(config.stripe.token)
const bufferLimit = 1000000000

class Webhook {
  static async receive (ctx) {
    let rawBody = await ctx.request.buffer(bufferLimit)
    let signature = ctx.get('stripe-signature')
    let event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.signature)
    console.log(event)
    return true
  }
}

module.exports = Webhook
