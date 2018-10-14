const config = require('../../config')

import nodemailer from 'nodemailer'
import { User, Reset } from '../db'
import crypto from 'crypto'
import BotServ from '../Anope/BotServ'
import { NotFoundAPIError } from '../classes/APIError'
import API, {
  GET,
  POST,
  parameters,
  required, permissions
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Users from './Users'

const EXPIRE_LENGTH = 86400000

export default class Resets extends API {
  @POST('/reset')
  @websocket('resets', 'request')
  @required('email')
  async requestReset (ctx, next) {
    let user = await User.findOne({
      where: {
        email: { $iLike: ctx.data.email }
      }
    })

    ctx.state.writeResp = false

    if (user) {
      let reset = await getReset(user, ctx.data.required)
      let html = await ctx.render('reset-email', {
        resetlink: Resets.getResetLink(reset.value)
      })
      await sendReset(ctx, user, reset, html)
    }

    ctx.body = 'OK'

    next()
  }

  @GET('/reset/generate/:email')
  @websocket('resets', 'generate')
  @parameters('email')
  @permissions('user.write')
  async generateReset (ctx) {
    let user = await User.findOne({
      where: {
        email: { $iLike: ctx.data.email }
      }
    })

    if (!user) {
      throw new NotFoundAPIError({ pointer: '/data/attributes/email' })
    }

    let reset = await getReset(user, ctx.data.required)

    ctx.response.status = 201
    return Resets.presenter.render(reset, API.meta(reset))
  }

  @GET('/reset/:token')
  @websocket('resets', 'validate')
  @parameters('token')
  async validateReset (ctx) {
    let reset = await Reset.findOne({
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
  @websocket('resets', 'set')
  @parameters('token')
  @required('password')
  async resetPassword (ctx, next) {
    let reset = await Reset.findOne({
      where: {
        value: ctx.params.token
      }
    })

    if (!reset) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    let user = await User.findOne({
      where: {
        id: reset.userId
      }
    })

    user.password = ctx.data.password

    await user.save()

    await reset.destroy()

    ctx.body = 'OK'
    next()
  }

  static getPlainTextEmail (resetToken) {
    let resetLink = Resets.getResetLink(resetToken)
    return `
    Someone has requested a password reset to your FuelRats Account
    
    To reset your password copy this link into your browser:
    ${resetLink}
    
    If you ignore this link, your password will not be changed.
    
    
    Regards,
    The Fuel Rats`
  }

  static getResetLink (resetToken) {
    return `https://fuelrats.com/password-reset?t=${resetToken}`
  }

  static get presenter () {
    class ResetsPresenter extends API.presenter {
      relationships () {
        return {
          users: Users.presenter
        }
      }
    }
    ResetsPresenter.prototype.type = 'resets'
    return ResetsPresenter
  }
}

/**
 * Get a reset key for a user
 * @param user the user to request a reset key for
 * @param required wether this reset is required before the user can access the account
 * @returns {Promise<void>}
 */
async function getReset (user, required = false) {
  let resets = await Reset.findAll({
    where: {
      userId: user.id
    }
  })

  await Promise.all(resets.map((reset) => {
    return reset.destroy()
  }))

  return Reset.create({
    value: crypto.randomBytes(global.RESET_TOKEN_LENGTH / 2).toString('hex'),
    expires: new Date(Date.now() + EXPIRE_LENGTH).getTime(),
    userId: user.id,
    required: required
  })
}

/**
 * Send a Reset Email
 * @param ctx the request context
 * @param user the user to send the email to
 * @param reset the reset object to use
 * @param html the HTML to use for the email
 * @returns {Promise<void>}
 */
async function sendReset (ctx, user, reset, html) {
  let transporter = nodemailer.createTransport({
    host: config.smtp.host
  })

  try {
    await transporter.sendMail({
      from: `Fuel Rats (Do Not Reply) <${config.smtp.email}>`,
      to: user.email,
      subject: 'Request to reset your Fuel Rats password',
      text: Resets.getPlainTextEmail(reset.value),
      html: html
    })
    BotServ.say(global.TECHNICAL_CHANNEL, `[API] Password reset for ${user.email} requested by ${ctx.inet}`)
  } catch (ex) {
    BotServ.say(global.TECHNICAL_CHANNEL, '[API] Password reset failed due to error from SMTP server')
    throw ex
  }
}
