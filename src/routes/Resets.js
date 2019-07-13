import Mail from '../classes/Mail'
import { User, Reset } from '../db'
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

export default class Resets extends API {
  get type () {
    return 'resets'
  }

  @POST('/reset')
  @websocket('resets', 'create')
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
      const existingReset = Reset.findOne({
        where: {
          userId: user.id
        }
      })

      let required = false
      if (existingReset) {
        if (existingReset.required === true) {
          required = true
        }
        await existingReset.destroy()
      }

      const reset = await Reset.create({
        value: crypto.randomBytes(expirationLength / 2).toString('hex'),
        expires: new Date(Date.now() + expirationLength).getTime(),
        userId: user.id,
        required
      })
      await mail.send({
        to: user.email,
        subject: 'Fuel Rats Password Reset Requested',
        body: {
          name: user.displayRat.name,
          intro: 'A password reset to your Fuel Rats Account has been requested.',
          action: {
            instructions: 'Click the button below to reset your password:',
            button: {
              color: '#d65050',
              text: 'Reset your password',
              link:  Resets.getResetLink(reset.value)
            }
          },
          goToAction: {
            text: 'Reset Password',
            link: Resets.getResetLink(reset.value),
            description: 'Click to reset your password'
          },
          outro: 'If you did not request a password reset, no further action is required on your part.',
          signature: 'Sincerely'
        }
      })
    }

    return true
  }

  @GET('/reset/:token')
  @parameters('token')
  async validate (ctx) {
    const reset = await Reset.findOne({
      where: {
        value: ctx.params.token
      }
    })

    if (!reset) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    return true
  }

  @POST('/reset/:token')
  @parameters('token')
  async reset (ctx) {
    const reset = await Reset.findOne({
      where: {
        value: ctx.params.token
      }
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
        id: reset.userId
      }
    })

    user.password = password

    await user.save()
    await reset.destroy()
    return true
  }

  static getResetLink (resetToken) {
    return `https://fuelrats.com/password-reset?t=${resetToken}`
  }
}
