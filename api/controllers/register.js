'use strict'

const { User, Rat, db} = require('../db')
const Errors = require('../errors')
const bcrypt = require('bcrypt')
const NickServ = require('../Anope/NickServ')
const HostServ = require('../Anope/NickServ')
const UserQuery = require('../Query/UserQuery')
const UserPresenter = require('../classes/Presenters').UsersPresenter
const { POST, Request } = require('../classes/Request')
const config = require('../../config.json')

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

    let transaction = await db.transaction()

    let email = ctx.data.email

    let password = await bcrypt.hash(ctx.data.password, 12)

    let user = await User.create({
      email: email,
      password: password
    }, {
      transaction: transaction
    })

    let name = ctx.data.name.replace(/CMDR/i, '')
    let platform = ctx.data.platform
    if (platforms.includes(platform) === false) {
      throw Errors.template('invalid_parameter', 'platform')
    }

    await Rat.create({
      name: name,
      platform: platform,
      userId: user.id
    }, {
      transaction: transaction
    })

    let nickname = ctx.data.nickname
    await NickServ.register(nickname, ctx.data.password, email)

    await User.update({ nicknames: db.cast([nickname], 'citext[]') }, {
      where: { id: user.id }
    })

    await transaction.commit()

    let userQuery = new UserQuery({ id: user.id }, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    await HostServ.update(user[0])

    let renderedResult = UserPresenter.render(result.rows, ctx.meta(result, userQuery))
    return renderedResult
  }
}

module.exports = Register