import API, {
  GET,
  POST,
  required,
  parameters,
  getJSONAPIData,
} from './API'
import Announcer, { ThrottledAnnouncer } from '../classes/Announcer'
import Anope from '../classes/Anope'
import { NotFoundAPIError } from '../classes/APIError'
import Mail from '../classes/Mail'
import { resetTokenGenerator } from '../classes/TokenGenerators'
import { websocket } from '../classes/WebSocket'
import config from '../config'
import { User, Reset } from '../db'
import { logMetric } from '../logging'
import passwordResetEmail from '../emails/reset'

const mail = new Mail()
const expirationLength = 86400000 // 24 Hours
const resetAnnouncer = new ThrottledAnnouncer({
  resetRate: 300000, // 5 minutes
  method: Announcer.sendTechnicalMessage,
})

/**
 * Class managing password reset endpoints
 */
export default class Resets extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'resets'
  }

  /**
   * Request a password reset
   * @endpoint
   */
  @POST('/resets')
  @websocket('resets', 'create')
  @required('email')
  async create (ctx) {
    const data = getJSONAPIData({ ctx, type: 'resets' })

    const { email } = data.attributes

    const user = await User.findOne({
      where: {
        email: { ilike: email },
      },
    })

    await resetAnnouncer.sendMessage({
      key: email,
      message: `[API] Password reset for ${email}${user ? '' : ' (Not in DB)'} requested by ${ctx.ip}`,
    })

    if (user) {
      const existingReset = await Reset.findOne({
        where: {
          userId: user.id,
        },
      })

      let requiredReset = false
      if (existingReset) {
        if (existingReset.required === true) {
          requiredReset = true
        }
        await existingReset.destroy()
      }

      const token = await resetTokenGenerator()

      const reset = await Reset.create({
        value: token,
        expires: new Date(Date.now() + expirationLength).getTime(),
        userId: user.id,
        required: requiredReset,
      })

      await mail.send(passwordResetEmail({ user, resetToken: reset.value }))
      
      // Log password reset request metrics
      logMetric('password_reset_requested', {
        _user_id: user.id,
        _ip: ctx.ip,
        _was_required: requiredReset,
        _had_existing_reset: !!existingReset,
      }, `Password reset requested for user ${user.id}`)
    } else {
      // Log invalid email attempt
      logMetric('password_reset_invalid_email', {
        _ip: ctx.ip,
      }, 'Password reset requested for non-existent email')
    }

    return true
  }

  /**
   * Validate a password reset token
   * @endpoint
   */
  @GET('/resets/:token')
  @parameters('token')
  async validate (ctx) {
    const reset = await Reset.findOne({
      where: {
        value: ctx.params.token,
      },
    })

    if (!reset) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    return true
  }

  /**
   * Use a token to reset a password
   * @endpoint
   */
  @POST('/resets/:token')
  @parameters('token')
  async reset (ctx) {
    const reset = await Reset.findOne({
      where: {
        value: ctx.params.token,
      },
    })

    if (!reset) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    const { password } = getJSONAPIData({ ctx, type: 'resets' }).attributes

    const user = await User.findOne({
      where: {
        id: reset.userId,
      },
    })

    user.password = password

    await user.save()
    await reset.destroy()
    await Anope.setPassword(user.email, password)
    
    // Log password reset completion metrics
    logMetric('password_reset_completed', {
      _user_id: user.id,
      _ip: ctx.ip,
      _was_required: reset.required,
    }, `Password reset completed for user ${user.id}`)
    
    return true
  }

  /**
   * Get a password reset link
   * @param {string} resetToken password reset token
   * @returns {string} password reset link
   */
  static getResetLink (resetToken) {
    return `${config.frontend.url}/verify?type=reset&t=${resetToken}`
  }
}
