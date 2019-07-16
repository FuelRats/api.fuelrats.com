import Mail from '../classes/Mail'
import { User, VerificationToken } from '../db'
import crypto from 'crypto'
import { NotFoundAPIError, UnprocessableEntityAPIError } from '../classes/APIError'
import API, {
  GET,
  POST,
  parameters,
  permissions,
  isValidJSONAPIObject
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Users from './Users'

const mail = new Mail()
const expirationLength = 86400000
const verificationTokenLength = 64

export default class Verifications extends API {
  get type () {
    return 'verifications'
  }

  @POST('/verifications')
  async create (ctx) {
    if (!isValidJSONAPIObject({ object: ctx.data.data }) || ctx.data.data.type !== this.type) {
      throw new UnprocessableEntityAPIError({ pointer: '/data' })
    }

    if (!(ctx.data.data.attributes instanceof Object)) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes' })
    }

    const { email } = ctx.data.data.attributes

    const user = await User.findOne({
      where: {
        email: { ilike: email }
      }
    })

    if (user) {
      await Verifications.createVerification(user)
    }

    return true
  }

  @GET('/verifications/:token')
  @parameters('token')
  async verify (ctx) {
    const verification = await VerificationToken.findOne({
      where: {
        value: ctx.params.token
      }
    })

    if (!verification) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    const user = await User.findOne({
      where: {
        id: verification.userId
      }
    })

    user.addGroup('verified')

    await user.save()
    await verification.destroy()
    return true
  }

  static async createVerification (user, transaction = undefined) {
    const existingVerification = VerificationToken.findOne({
      where: {
        userId: user.id
      }
    })

    if (existingVerification) {
      await existingVerification.destroy()
    }

    const verification = await VerificationToken.create({
      value: crypto.randomBytes(verificationTokenLength / 2).toString('hex'),
      expires: new Date(Date.now() + expirationLength).getTime(),
      userId: user.id
    }, { transaction })

    await mail.send({
      to: user.email,
      subject: 'Fuel Rats Email Verification Required',
      body: {
        name: user.preferredRat.name,
        intro: 'To complete the creation of your Fuel Rats Account your email address needs to be verified.',
        action: {
          instructions: 'Click the button below to verify your email:',
          button: {
            color: '#d65050',
            text: 'Verify me',
            link:  Verifications.getVerifyLink(verification.value)
          }
        },
        goToAction: {
          text: 'Verify Email Address',
          link: Verifications.getVerifyLink(verification.value),
          description: 'Click to verify your email'
        },
        outro: 'If you are having problems with verification you may contact support@fuelrats.com',
        signature: 'Sincerely'
      }
    })
  }

  static getVerifyLink (resetToken) {
    return `https://fuelrats.com/verify?type=email&t=${resetToken}`
  }
}
