'use strict'
const BCRYPT_ENCRYPTION_ROUNDS = 12

const { User, Rat, db} = require('../db')
const Errors = require('../errors')
const bcrypt = require('bcrypt')
const NickServ = require('../Anope/NickServ')
const HostServ = require('../Anope/HostServ')
const BotServ = require('../Anope/BotServ')
const UserQuery = require('../Query/UserQuery')
const UserPresenter = require('../classes/Presenters').UsersPresenter


const platforms = ['pc', 'xb', 'ps']

class Register {
  static async create (ctx) {
    // let captcha = ctx.data['g-recaptcha-response']
    // let captchaResult = await new Request(POST, {
    //   host: 'www.google.com',
    //   path: '/recaptcha/api/siteverify'
    // }, {
    //   secret: config.recaptcha.secret,
    //   response: captcha,
    //   remoteip: ctx.inet
    // })
    //
    // if (captchaResult.body.success === false) {
    //   throw Errors.template('invalid_parameter', 'g-recaptcha-response')
    // }

    let { email, name, nickname } = ctx.data

    let existingUser = await User.findOne({
      where: {
        email: {
          $iLike: email
        }
      }
    })
    if (existingUser) {
      throw Errors.template('operation_failed', 'email already exists')
    }

    let transaction = await db.transaction()

    try {

      let password = await bcrypt.hash(ctx.data.password, BCRYPT_ENCRYPTION_ROUNDS)

      let user = await User.create({
        email: email,
        password: password
      }, {
        transaction: transaction
      })

      name = name.replace(/CMDR/i, '')
      let { platform } = ctx.data
      if (platforms.includes(platform) === false) {
        // noinspection ExceptionCaughtLocallyJS
        throw Errors.template('invalid_parameter', 'platform')
      }

      await Rat.create({
        name: name,
        platform: platform,
        userId: user.id
      }, {
        transaction: transaction
      })

      await NickServ.register(nickname, ctx.data.password, email)

      await User.update({ nicknames: db.cast([nickname], 'citext[]') }, {
        where: { id: user.id }
      })

      await transaction.commit()

      let userQuery = new UserQuery({ id: user.id }, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
      let presentedUsers = UserPresenter.render(result.rows, ctx.meta(result, userQuery))

      await HostServ.update(presentedUsers.data[0])
      process.emit('registration', ctx, ctx.data)

      ctx.body = presentedUsers
    } catch (ex) {
      transaction.rollback()
      throw ex
    }
  }
}

process.on('registration', (ctx, values) => {
  BotServ.say('#rat-ops',
    `[API] User with email ${values.email} registered. IRC Nickname: ${values.nickname}. CMDR name: ${values.name}`)
})

module.exports = Register
