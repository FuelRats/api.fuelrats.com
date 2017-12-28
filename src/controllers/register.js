
const BCRYPT_ENCRYPTION_ROUNDS = 12

import { User, Rat, db} from '../db'
import bcrypt from 'bcrypt'
import NickServ from '../Anope/NickServ'
import HostServ from '../Anope/HostServ'
import BotServ from '../Anope/BotServ'
import UserQuery from '../Query/UserQuery'
import APIEndpoint from '../APIEndpoint'
import Users from './user'
import { ConflictAPIError,UnprocessableEntityAPIError } from '../APIError'

const platforms = ['pc', 'xb', 'ps']

class Register extends APIEndpoint {
  async create (ctx) {
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
      throw ConflictAPIError({
        pointer: '/data/attributes/email'
      })
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
        throw UnprocessableEntityAPIError({
          pointer: '/data/attributes/platform'
        })
      }

      await Rat.create({
        name: name,
        platform: platform,
        userId: user.id
      }, {
        transaction: transaction
      })

      nickname = nickname.replace(/\[.*]/i, '')

      await NickServ.register(nickname, ctx.data.password, email)

      await User.update({ nicknames: db.cast([nickname], 'citext[]') }, {
        where: { id: user.id }
      })

      await transaction.commit()

      let userQuery = new UserQuery({ id: user.id }, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
      await HostServ.update(user[0])
      process.emit('registration', ctx, ctx.data)

      ctx.body = Users.presenter.render(result.rows, ctx.meta(result, userQuery))
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