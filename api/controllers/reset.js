'use strict'

const { User, Reset } = require('../db')
const crypto = require('crypto')
const Error = require('../errors')
const bcrypt = require('bcrypt')
const BotServ = require('../Anope/BotServ')
const Mail = require('../classes/Mail')
const { UsersPresenter } = require('../classes/Presenters')

let mail = new Mail()

const BCRYPT_ROUNDS_COUNT = 12
const RESET_TOKEN_LENGTH = 16
const EXPIRE_LENGTH = 86400000

class Resets {
  static async requestReset (ctx) {
    let user = await User.scope('defaultScope', 'profile').findOne({
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

    let userResponse = UsersPresenter.render(user, {})
    let displayRat = User.preferredRat(userResponse)

    try {
      await mail.send({
        to: user.email,
        subject: 'Fuel Rats Password Reset Requested',
        body: {
          name: displayRat.name,
          intro: 'A password reset to your Fuel Rats Account has been requested.',
          action: {
            instructions: 'Click the button below to reset your password:',
            button: {
              color: '#d65050',
              text: 'Reset your password',
              link:  Resets.getResetLink(reset.value)
            }
          },
          outro: 'If you did not request a password reset, no further action is required on your part.'
        }
      })
      BotServ.say('#rattech', `[API] Password reset for ${user.email} requested by ${ctx.inet}`)
    } catch (ex) {
      BotServ.say('#rattech', '[API] Password reset failed due to error from SMTP server')
      return Error.template('server_error')
    }
    return true
  }

  static async validateReset (ctx) {
    if (!ctx.params.token) {
      throw Error.template('missing_required_field', 'token')
    }

    let reset = await Reset.findOne({
      where: {
        value: ctx.params.token
      }
    })

    if (!reset) {
      throw Error.template('not_found', 'reset link invalid or expired')
    }

    return true
  }

  static async resetPassword (ctx, next) {
    if (!ctx.params.token) {
      throw Error.template('missing_required_field', 'token')
    }

    if (!ctx.data.password) {
      throw Error.template('missing_required_field', 'password')
    }

    let reset = await Reset.findOne({
      where: {
        value: ctx.params.token
      }
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

    reset.destroy()

    ctx.body = 'OK'
    next()
  }

  static getResetLink (resetToken) {
    return `https://fuelrats.com/password-reset?t=${resetToken}`
  }
}

module.exports = Resets
