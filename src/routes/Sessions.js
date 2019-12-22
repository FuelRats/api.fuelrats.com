import Mail from '../classes/Mail'
import { Session, User, db } from '../db'
import crypto from 'crypto'
import { NotFoundAPIError } from '../classes/APIError'
import { Context } from '../classes/Context'
import API, {
  GET,
  parameters
} from '../classes/API'
import GeoIP from '../classes/GeoIP'
import UAParser from 'ua-parser-js'

const mail = new Mail()
const sessionTokenLength = 64

/**
 * Class managing user session endpoints
 */
export default class Sessions extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'sessions'
  }

  /**
   * Verify a session token
   * @endpoint
   */
  @GET('/sessions/:token')
  @parameters('token')
  async verify (ctx) {
    const session = await Session.findOne({
      where: {
        code: ctx.params.token,
        verified: false
      }
    })

    if (!session) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    await session.update({
      verified: true,
      lastAccess: Date.now()
    })

    return true
  }

  /**
   * Create a user session verification
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @returns {Promise<void>} completes a promise when email is sent
   */
  static async createSession (ctx, user) {
    const session = await Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      code: crypto.randomBytes(sessionTokenLength / 2).toString('hex'),
      userId: user.id
    })

    return Sessions.sendSessionMail(user.email, user.preferredRat.name, session.code, ctx)
  }

  /**
   * Create a verified user session
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @param {db.Transaction} transaction Sequelize transaction
   * @returns {Session} user session
   */
  static createVerifiedSession (ctx, user, transaction = undefined) {
    return Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      code: crypto.randomBytes(sessionTokenLength / 2).toString('hex'),
      userId: user.id,
      verified: true
    }, { transaction })
  }

  /**
   * Send a user session verification email
   * @param {string} email the user's email
   * @param {string} name the user's display name
   * @param {string} code verification code
   * @param {Context} ctx request context
   * @returns {Promise<void>} completes a promise when successful
   */
  static sendSessionMail (email, name, code, ctx) {
    const ipAddress = ctx.request.ip

    const geoip = GeoIP.lookup(ipAddress)
    const locationString = `${geoip.city.names.en}, ${geoip.postal.code} ${geoip.country.names.en}`

    return mail.send({
      to: email,
      subject: 'Fuel Rats: Login from a new location',
      body: {
        name,
        intro: 'An attempt was made to login to your Fuel Rats account from a new location.',
        action: {
          instructions: 'Click the button below to authorise the login:',
          button: {
            color: '#d65050',
            text: 'Authorise login',
            link:  Sessions.getVerifyLink(code)
          }
        },
        goToAction: {
          text: 'Authorise login',
          link: Sessions.getVerifyLink(code),
          description: 'Click to authorise the login from a new location'
        },
        dictionary: {
          'Device': Sessions.generateDeviceDescription(ctx.state.userAgent),
          'Location': locationString,
          'IP Address': ipAddress
        },
        outro: 'If this login was not by you then please change your password immediately and contact administrators!',
        signature: 'Sincerely'
      }
    })
  }

  /**
   * Generate a short device description based on a user agent
   * @param {object} userAgent parsed user agent
   * @returns {string} short device description
   */
  static generateDeviceDescription (userAgent) {
    const ua = new UAParser(userAgent)
    if (!ua.getBrowser().name) {
      return 'Unknown device'
    }
    return `${ua.getBrowser().name} ${ua.getBrowser().version} on ${ua.getOS().name}`
  }

  /**
   * Get a verification link
   * @param {string} verifyToken the verification token
   * @returns {string} a verification link
   */
  static getVerifyLink (verifyToken) {
    return `https://fuelrats.com/verify?type=session&t=${verifyToken}`
  }
}
