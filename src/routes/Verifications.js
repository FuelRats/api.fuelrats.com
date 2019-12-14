import Mail from '../classes/Mail'
import { User, VerificationToken, db } from '../db'
import crypto from 'crypto'
import { NotFoundAPIError } from '../classes/APIError'
import { Context } from '../classes/Context'
import API, {
  GET,
  POST,
  parameters,
  getJSONAPIData
} from '../classes/API'

const mail = new Mail()
const expirationLength = 86400000
const verificationTokenLength = 64

/**
 * @classdesc API endpoint for handling account email verifications
 * @class
 */
export default class Verifications extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'verifications'
  }

  /**
   * Request a new account verification
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} a 204 is returned when successful
   */
  @POST('/verifications')
  async create (ctx) {
    const { email } = getJSONAPIData({ ctx, type: 'verifications' })

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

  /**
   * Verify an account using a token
   * @param {Context} ctx request token
   * @returns {Promise<boolean>} a 204 is returned when successful
   */
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

  /**
   * Create a verification token and send it to a user
   * @param {db.User} user the user to send it to
   * @param {db.transaction?} transaction optional database transaction to use for the operation
   * @returns {Promise<undefined>} Resolves a promise when the operation is complete.
   */
  static async createVerification (user, transaction = undefined) {
    const existingVerification = await VerificationToken.findOne({
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

  /**
   * Generate a verification link from a reset token
   * @param {string} resetToken the reset token
   * @returns {string} a verification link
   */
  static getVerifyLink (resetToken) {
    return `https://fuelrats.com/verify?type=email&t=${resetToken}`
  }
}
