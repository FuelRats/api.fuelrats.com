'use strict'

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

module.exports = Mail
