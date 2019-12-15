import nodemailer from 'nodemailer'
import Mailgen from 'mailgen'
import path from 'path'
import config from '../../config'

/**
 * Class for managing sending emails
 */
export default class Mail {
  /**
   * Create a mail sender class instance
   */
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

  /**
   * Send an email
   * @param {object} arg function arguments object
   * @param {string} arg.to the email recipient
   * @param {string } arg.subject the email subject
   * @param {object} arg.body mailgen body configuration
   * @returns {Promise<void>} fulfills a promise when successful
   */
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
