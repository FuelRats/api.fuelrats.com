'use strict'

const Mailgen = require('mailgen')
const nodemailer = require('nodemailer')

class Mail {
  constructor () {
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.gmail.com',
      port: 587
    })

    this.mailgen = new Mailgen({
      theme: 'default',
      product: {
        name: 'The Fuel Rats',
        link: 'https://fuelrats.com/',
        logo: 'https://wordpress.fuelrats.com/wp-content/uploads/2018/09/roundel_black.jpg'
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

module.exports = Mail
