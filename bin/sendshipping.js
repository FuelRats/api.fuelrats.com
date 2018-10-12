'use strict'
const [,,token, orderId] = process.argv

const BotServ = require('../api/Anope/BotServ')
const stripe = require('stripe')(token)
const Mailgen = require('mailgen')
const nodemailer = require('nodemailer')
const path = require('path')

class Mail {
  constructor () {
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.gmail.com',
      port: 587
    })

    this.mailgen = new Mailgen({
      theme: {
        path: path.resolve('static/mailgen/index.html'),
        plaintextPath: path.resolve('static/mailgen/index.txt')
      },
      product: {
        name: 'The Fuel Rats',
        link: 'https://fuelrats.com/',
        logo: 'https://wordpress.fuelrats.com/wp-content/uploads/2018/09/email.jpg'
      }
    })
  }

  async send ({to: recipient, subject, body}) {
    let email = {
      body
    }

    await this.transporter.sendMail({
      from: 'Fuel Rats (Do Not Reply) <blackhole@fuelrats.com>',
      to: recipient,
      subject: subject,
      text: this.mailgen.generatePlaintext(email),
      html: this.mailgen.generate(email)
    })
  }
}

const royalMailTrackingCode = /^[A-Z]{2}[0-9]{9}GB$/iu
const parcelForceTrackingCode = /^(EA|EB|EC|ED|EE|CP)[0-9]{9}[A-Z]{2}$/iu
let mail = new Mail()


/**
 * Send shipment email
 * @param orderId the order Id
 * @returns {Promise<void>}
 */
async function sendShipmentEmail (orderId) {
  let order = await stripe.orders.retrieve(orderId)

  let email = {
    to: order.email,
    subject: 'Fuel Rats Store Shipping Confirmation',
    body: {
      name: order.shipping.name,
      intro: `Your order has been shipped with ${order.shipping.carrier}`,
      signature: 'Sincerely'
    }
  }

  let link = getTrackingLink(order.shipping.tracking_number)
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

  BotServ.say('#ratmerch', `[API] Order ${order.id} of has been shipped`)
  try {
    await mail.send(email)
  } catch (ex) {
    BotServ.say('#ratmerch', '[API] Sending of shipping confirmation failed due to error from SMTP server')
    console.error(ex)
  }
}

sendShipmentEmail(orderId)


/**
 * Geneerate a tracking link from a tracking number
 * @param number the tracking number
 * @returns {?string} a tracking link
 */
function getTrackingLink (number) {
  if (!number) {
    return null
  }

  if (royalMailTrackingCode.test(number) === true) {
    return `https://www.royalmail.com/portal/rm/track?trackNumber=${number}`
  } else if (parcelForceTrackingCode.test(number) === true) {
    return `http://www.parcelforce.com/portal/pw/track?trackNumber=${number}`
  }
  return null
}


