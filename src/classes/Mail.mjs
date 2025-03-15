import ejs from 'ejs'
import fs from 'fs'
import nodemailer from 'nodemailer'
import path from 'path'
import config from '../config'

/**
 * Load plain text email contents from disk
 * @returns {{}}
 */
function loadTextEmails () {
  const files = fs.readdirSync(path.join('static', 'email', 'plain'))
  return files.reduce((acc, fileName) => {
    acc[fileName.split('.')[0]] = fs.readFileSync(path.join('static', 'email', 'plain', fileName), 'utf8')
    return acc
  }, {})
}

const textEmails = loadTextEmails()

/**
 * Class for managing sending emails
 */
export default class Mail {
  /**
   * Create a mail sender class instance
   */
  constructor () {
    let auth = undefined
    if (config.smtp.username && config.smtp.password) {
      auth = {
        user: config.smtp.username,
        pass: config.smtp.password,
      }
    }
    this.transporter = nodemailer.createTransport({
      host: config.smtp.hostname,
      port: config.smtp.port,
      auth,
    })
  }

  /**
   * Send an email
   * @param {object} arg function arguments object
   * @param {string} arg.to the email recipient
   * @param {string } arg.subject the email subject
   * @param {object} arg.template email template name
   * @param {object} arg.params template parameters
   * @returns {Promise<void>} fulfills a promise when successful
   */
  async send ({ to: recipient, subject, template, params }) {
    await this.transporter.sendMail({
      from: 'Fuel Rats (Do Not Reply) <blackhole@fuelrats.com>',
      to: recipient,
      subject,
      text: Mail.interpolate(textEmails[template], params),
      html: await Mail.render(template, { ...params, title: subject }),
    })
  }

  /**
   * Interpolate a text string replacing variables in the format of an ES2015 string literal
   * @param {string} text text to interpolate
   * @param {object} params object map of variables to interpolate in
   * @returns {string} interpolated string
   */
  static interpolate (text, params) {
    return text.replace(/%\{([a-zA-Z0-9-_]*)\}/gu, (match, group) => {
      return params[group]
    })
  }

  /**
   * Render an email template with EJS
   * @param {string} template name of the template
   * @param {object} params interpolation parameters
   * @returns {string} a rendered HTML document
   */
  static render (template, params) {
    return ejs.renderFile(`static/email/${template}.ejs`, params, {
      cache: true,
      fiilename: template,
      rmWhitespace: true,
    })
  }
}
