'use strict'

const config = require('../../../config')
const Errors = require('../../errors')
const Mail = require('../../classes/Mail')
const Shipping = require('../../classes/Shipping')
const BotServ = require('../../Anope/BotServ')
const stripe = require('stripe')(config.stripe.token)
const bufferLimit = 1000000000

const royalMailTrackingCode = /^[A-Z]{2}[0-9]{9}GB$/iu
const parcelForceTrackingCode = /^(EA|EB|EC|ED|EE|CP)[0-9]{9}[A-Z]{2}$/iu

let mail = new Mail()
let shipping = new Shipping()

class Webhook {
  static async receive (ctx) {
    let rawBody = await ctx.request.buffer(bufferLimit)
    let signature = ctx.get('stripe-signature')
    let event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.signature)
    switch (event.type) {
      case 'order.payment_succeeded':
        await Webhook.paymentSuccessful(event)
        break

      case 'order.updated':
        await Webhook.orderUpdated(event)
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
        currencyDisplay: 'symbol'
      })
      return {
        item: item.description,
        quantity: item.quantity,
        price: amount
      }
    })

    await shipping.uploadLabel(event.data.object)

    try {
      await mail.send({
        to: event.data.object.email,
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
      BotServ.say('#ratmerch', '[API] New order ${event.data.object.id} of ${amount} has been received')
    } catch (ex) {
      BotServ.say('#rattech', '[API] Sending of order confirmation failed due to error from SMTP server')
      return Errors.template('server_error')
    }
  }

  static async orderUpdated (event) {
    let isFulfiled = (event.data.object.status === 'fulfiled')
    let isStatusChange = (event.data.previous_attributes.status !== undefined)
    if (isFulfiled === false || isStatusChange === false) {
      return
    }

    let email = {
      to: event.data.object.email,
      subject: 'Fuel Rats Store Shipping Confirmation',
      body: {
        name: event.data.object.shipping.name,
        intro: `Your order has been shipped with ${event.data.object.shipping.carrier}`,
        signature: 'Sincerely'
      }
    }

    let link = getTrackingLink(event.data.object.shipping.tracking_number)
    if (link) {
      email.body.action = {
        instructions: 'You can click here to track the shipment of your order:',
        button: {
          color: '#d65050',
          text: 'View Tracking',
          link: link
        }
      }
      email.body.goToAction = {
        text: 'View Tracking',
        link: link,
        description: 'Check the tracking status of your shipment'
      }
    }

    BotServ.say('#ratmerch', '[API] Order ${event.data.object.id} of has been shipped')
    try {
      await mail.send(email)
    } catch (ex) {
      BotServ.say('#rattech', '[API] Sending of shipping confirmation failed due to error from SMTP server')
      return Error.template('server_error')
    }
  }
}

/**
 * Geneerate a tracking link from a tracking number
 * @param number the tracking number
 * @returns {?string} a tracking link
 */
function getTrackingLink (number) {
  if (!number) {
    return null
  }

  switch (number) {
    case royalMailTrackingCode.test(number):
      return `https://www.royalmail.com/portal/rm/track?trackNumber=${number}`

    case parcelForceTrackingCode.test(number):
      return `http://www.parcelforce.com/portal/pw/track?trackNumber=${number}`

    default:
      return null
  }
}

module.exports = Webhook
