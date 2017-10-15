'use strict'

const nodemailer = require('nodemailer')
const User = require('../db').User
const Reset = require('../db').Reset
const crypto = require('crypto')
const Error = require('../errors')
const bcrypt = require('bcrypt')

const BCRYPT_ROUNDS_COUNT = 12
const RESET_TOKEN_LENGTH = 16
const EXPIRE_LENGTH = 86400000

class Resets {
  static async requestReset (ctx, next) {
    let user = await User.findOne({
      where: {
        email: { $iLike: ctx.data.email }
      }
    })

    if (!user) {
      throw Error.template('not_found', 'email does not exist')
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
    transporter.sendMail({
      from: 'Fuel Rats (Do Not Reply) <fuelrats@localecho.net>',
      to: user.email,
      subject: 'Fuel Rats Password Reset Requested',
      text: Resets.getPlainTextEmail(reset.value),
      html: html
    })

    ctx.body = 'OK'

    next()
  }

  static async validateReset (ctx) {
    if (!ctx.params.token) {
      throw Error.template('missing_required_field', 'token')
    }

    let reset = await Reset.findOne({
      value: ctx.params.token
    })

    if (!reset) {
      throw Error.template('not_found', 'reset link invalid or expired')
    }

    return true
  }

  static async resetPassword (ctx) {
    if (!ctx.params.token) {
      throw Error.template('missing_required_field', 'token')
    }

    if (!ctx.data.password) {
      throw Error.template('missing_required_field', 'password')
    }

    let reset = await Reset.findOne({
      value: ctx.params.token
    })

    if (!reset) {
      throw Error.template('not_found', 'reset link invalid or expired')
    }

    let newPassword = await bcrypt.hash(ctx.data.password, BCRYPT_ROUNDS_COUNT)
    await User.update({
      password: newPassword
    }, {
      where: { id: reset.userId }
    })
    return true
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

module.exports = Resets