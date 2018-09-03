'use strict'

const config = require('../../../config')
const Mail = require('../../classes/Mail')
const BotServ = require('../../Anope/BotServ')
const stripe = require('stripe')(config.stripe.token)
const bufferLimit = 1000000000

let mail = new Mail()

class Webhook {
  static async receive (ctx) {
    let rawBody = await ctx.request.buffer(bufferLimit)
    let signature = ctx.get('stripe-signature')
    let event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.signature)
    switch (event.type) {
      case 'order.payment_succeeded':
        await Webhook.paymentSuccessful(event)
        break

      default:
        break
    }
    return true
  }

  static async paymentSuccessful (event) {
    let orderItems = event.data.object.items.map((item) => {
      let amount = (item.amount / 100).toLocaleString('en-GB', {
        style: 'currency',
        currency: item.currency,
        currencyDisplay: 'code'
      })
      return {
        item: item.description,
        quantity: item.quantity,
        price: amount
      }
    })

    try {
      await mail.send({
        to: 'alex@sorlie.eu',
        subject: 'Fuel Rats Store Order Confirmation',
        body: {
          name: event.data.object.shipping.name,
          intro: 'Your order has been processed',
          table: {
            data: orderItems,
            columns: {
              customWidth: {
                item: '20%',
                quantity: '15%',
                price: '15%'
              },
              customAlignment: {
                quantity: 'right',
                price: 'right'
              }
            }
          },
          action: {
            instructions: 'You can click here to check the status of your order:',
            button: {
              color: '#d65050',
              text: 'View Order',
              link: `https://fuelrats.com/store/order/${event.data.object.id}`
            }
          },
          goToAction: {
            text: 'View Order',
            link: `https://fuelrats.com/store/order/${event.data.object.id}`,
            description: 'Check the status of your order'
          },
          signature: 'Sincerely'
        }
      })
    } catch (ex) {
      BotServ.say('#rattech', '[API] Sending of order confirmation failed due to error from SMTP server')
      return Error.template('server_error')
    }
  }
}

module.exports = Webhook
