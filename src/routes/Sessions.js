import Mail from '../classes/Mail'
import { User, Session } from '../db'
import crypto from 'crypto'
import { NotFoundAPIError, UnprocessableEntityAPIError } from '../classes/APIError'
import API, {
  GET,
  parameters,
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Users from './Users'
import GeoIP from '../classes/GeoIP'
import UAParser from 'ua-parser-js'

const mail = new Mail()
const expirationLength = 86400000
const sessionTokenLength = 64

export default class Sessions extends API {
  get type () {
    return 'sessions'
  }

  @GET('/session/:token')
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

  static async createSession (ctx, user) {
    const session = await Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      code: crypto.randomBytes(sessionTokenLength / 2).toString('hex'),
      userId: user.id
    })

    return Sessions.sendSessionMail(user.email, user.preferredRat.name, session.code, ctx)
  }

  static createVerifiedSession (ctx, user, transaction = undefined) {
    return Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      code: crypto.randomBytes(sessionTokenLength / 2).toString('hex'),
      userId: user.id,
      verified: true
    }, { transaction })
  }

  static sendSessionMail (email, name, code, ctx) {
    const ipAddress = ctx.request.ip

    const geoip = GeoIP.lookup(ipAddress)
    const locationString = `${geoip.city.names.en}, ${geoip.postal.code} ${geoip.country.names.en}`

    return mail.send({
      to: email,
      subject: 'Fuel Rats: Login from a new location',
      body: {
        name,
        intro: 'An attempt was made to login to your Fuel Rats account from an unknown location.',
        action: {
          instructions: 'Click the button below to authorise the login from a new location:',
          button: {
            color: '#d65050',
            text: 'Authorise login',
            link:  Sessions.getVerifyLink(code)
          }
        },
        goToAction: {
          text: 'Authorise login from new location',
          link: Sessions.getVerifyLink(code),
          description: 'Click to authorise the login from a new location'
        },
        dictionary: {
          'Device': Sessions.generateDeviceDescription(ctx.state.userAgent),
          'Location': locationString,
          'IP Address': ipAddress
        },
        outro: 'If you did not make this request please change your password immediately!',
        signature: 'Sincerely'
      }
    })
  }

  static generateDeviceDescription (userAgent) {
    const ua = new UAParser(userAgent)
    if (!ua.getBrowser().name) {
      return 'Unknown device'
    }
    return `${ua.getBrowser().name} ${ua.getBrowser().version} on ${ua.getOS().name}`
  }

  static getVerifyLink (resetToken) {
    return `https://fuelrats.com/verify?type=session&t=${resetToken}`
  }
}
