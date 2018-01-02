

import nodemailer from 'nodemailer'
import { User, Reset } from '../db'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import BotServ from '../Anope/BotServ'
import { NotFoundAPIError } from '../classes/APIError'
import API, {
  GET,
  POST,
  parameters,
  required,
  websocket
} from '../classes/API'

const RESET_TOKEN_LENGTH = 16
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

    if (!user) {
      throw new NotFoundAPIError({ pointer: '/data/attributes/email' })
    }

    let resets = await Reset.findAll({
      where: {
        userId: user.id
      }
    })

    resets.map((reset) => {
      reset.destroy()
    })

    let reset = await Reset.create({
      value: crypto.randomBytes(RESET_TOKEN_LENGTH).toString('hex'),
      expires: new Date(Date.now() + EXPIRE_LENGTH).getTime(),
      userId: user.id
    })

    ctx.state.writeResp = false
    let html = await ctx.render('reset-email', {
      resetlink: Resets.getResetLink(reset.value)
    })

    let transporter = nodemailer.createTransport('smtp://orthanc.localecho.net')
    try {
      await transporter.sendMail({
        from: 'Fuel Rats (Do Not Reply) <blackhole@fuelrats.com>',
        to: user.email,
        subject: 'Fuel Rats Password Reset Requested',
        text: Resets.getPlainTextEmail(reset.value),
        html: html
      })
      BotServ.say('#rattech', `[API] Password reset for ${user.email} requested by ${ctx.inet}`)
    } catch (ex) {
      BotServ.say('#rattech', '[API] Password reset failed due to error from SMTP server')
      return
    }

    ctx.body = 'OK'

    next()
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

    let newPassword = await bcrypt.hash(ctx.data.password, global.BCRYPT_ROUNDS_COUNT)
    await User.update({
      password: newPassword
    }, {
      where: { id: reset.userId }
    })

    reset.destroy()

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
}