import { NotFoundAPIError, UnprocessableEntityAPIError } from '../classes/APIError'
import Announcer from '../classes/Announcer'
import Mail from '../classes/Mail'
import { resetTokenGenerator } from '../classes/TokenGenerators'
import { websocket } from '../classes/WebSocket'
import config from '../config'
import { User, Reset } from '../db'
import passwordResetEmail from '../emails/reset'
import API, {
  GET,
  POST,
  required,
  parameters,
  isValidJSONAPIObject,
  getJSONAPIData,
} from './API'

const mail = new Mail()
const expirationLength = 86400000

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

    await Announcer.sendTechnicalMessage({
      message: `[API] Password reset for ${email} requested by ${ctx.ip}`,
    })

    const user = await User.findOne({
      where: {
        email: { ilike: email },
      },
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

    if (!isValidJSONAPIObject({ object: ctx.data.data }) || ctx.data.data.type !== this.type) {
      throw new UnprocessableEntityAPIError({ pointer: '/data' })
    }

    if (!(ctx.data.data.attributes instanceof Object)) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes' })
    }

    const { password } = ctx.data.data.attributes

    const user = await User.findOne({
      where: {
        id: reset.userId,
      },
    })

    user.password = password

    await user.save()
    await reset.destroy()
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
