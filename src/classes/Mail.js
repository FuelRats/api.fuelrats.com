import nodemailer from 'nodemailer'
import Mailgen from 'mailgen'
import path from 'path'
import config from '../../config'

export default class Mail {
  constructor () {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port
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

  async send ({ to: recipient, subject, body }) {
    const email = {
      body
    }

    await this.transporter.sendMail({
      from: 'Fuel Rats (Do Not Reply) <blackhole@fuelrats.com>',
      to: recipient,
      subject,
      text: this.mailgen.generatePlaintext(email),
      html: this.mailgen.generate(email)
    })
  }
}
