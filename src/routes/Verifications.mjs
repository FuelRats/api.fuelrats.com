import API, {
  GET,
  POST,
  parameters,
  getJSONAPIData,
} from './API'
import Anope from '../classes/Anope'
import {
  ConflictAPIError,
  InternalServerError,
  NotFoundAPIError,
  UnprocessableEntityAPIError,
} from '../classes/APIError'
import { Context } from '../classes/Context'
import Mail from '../classes/Mail'
import { verificationTokenGenerator } from '../classes/TokenGenerators'
import { User, VerificationToken, Group, db } from '../db'
import { logMetric } from '../logging'
import verificationEmail from '../emails/verification'

const mail = new Mail()
const expirationLength = 86400000

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
    const { email } = getJSONAPIData({ ctx, type: 'verifications' }).attributes

    if (!email) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/email' })
    }

    const user = await User.findOne({
      where: {
        email: { ilike: email },
      },
    })

    const verified = user.groups.some((group) => {
      return group.name === 'verified'
    })

    if (verified) {
      throw new ConflictAPIError({
        pointer: '/data/attributes/email',
      })
    }

    if (user) {
      await Verifications.createVerification(user)
      
      // Log verification request metrics
      logMetric('email_verification_requested', {
        _user_id: user.id,
        _ip: ctx.ip,
        _already_verified: verified,
      }, `Email verification requested for user ${user.id}`)
    } else {
      // Log request for non-existent user
      logMetric('email_verification_invalid_email', {
        _ip: ctx.ip,
      }, 'Email verification requested for non-existent email')
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
        value: ctx.params.token,
      },
    })

    if (!verification) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    const user = await User.findOne({
      where: {
        id: verification.userId,
      },
    })

    const verificationGroup = await Group.findOne({
      where: {
        name: 'verified',
      },
    })

    if (!verificationGroup) {
      throw new InternalServerError({})
    }

    await user.addGroup(verificationGroup.id)

    const updatedUser = await User.findOne({
      where: { id: user.id },
    })
    await Anope.updatePermissions(updatedUser)
    await verification.destroy()
    
    // Log verification completion metrics
    logMetric('email_verification_completed', {
      _user_id: user.id,
      _ip: ctx.ip,
    }, `Email verification completed for user ${user.id}`)
    
    return true
  }

  /**
   * Create a verification token and send it to a user
   * @param {User} user the user to send it to
   * @param {db.transaction?} transaction optional database transaction to use for the operation
   * @param {boolean} [change] Is this a change to an existing account?
   * @returns {Promise<undefined>} Resolves a promise when the operation is complete.
   */
  static async createVerification (user, transaction = undefined, change = false) {
    const existingVerification = await VerificationToken.findOne({
      where: {
        userId: user.id,
      },
    })

    if (existingVerification) {
      await existingVerification.destroy()
    }

    const verification = await VerificationToken.create({
      value: await verificationTokenGenerator(),
      expires: new Date(Date.now() + expirationLength).getTime(),
      userId: user.id,
    }, { transaction })

    await mail.send(verificationEmail({ user, verificationToken: verification.value, change }))
  }
}
