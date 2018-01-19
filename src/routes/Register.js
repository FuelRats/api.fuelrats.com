import { User, Rat, db, npoMembership } from '../db'
import NickServ from '../Anope/NickServ'
import HostServ from '../Anope/HostServ'
import BotServ from '../Anope/BotServ'
import UserQuery from '../query/UserQuery'
import API, {
  POST,
  required
} from '../classes/API'
import Users from './Users'
import { ConflictAPIError,UnprocessableEntityAPIError } from '../classes/APIError'

const platforms = ['pc', 'xb', 'ps']

export default class Register extends API {
  @POST('/register')
  @required('email', 'password', 'name', 'platform', 'nickname')
  async create (ctx) {
    let userId = null
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

    let { email, name, nickname, password, ircPassword, platform } = ctx.data

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

    let existingRat = await Rat.findOne({
      where: {
        name: {
          $iLike: name
        },
        platform: platform
      }
    })
    if (existingRat) {
      throw ConflictAPIError({
        pointer: '/data/attributes/name'
      })
    }

    let transaction = await db.transaction()

    try {
      let user = await User.create({
        email: email,
        password: password
      }, {
        transaction
      })

      userId = user.id

      await user.addGroup('default', {
        transaction
      })

      name = name.replace(/CMDR/i, '')
      if (platforms.includes(platform) === false) {
        // noinspection ExceptionCaughtLocallyJS
        throw UnprocessableEntityAPIError({
          pointer: '/data/attributes/platform'
        })
      }

      if (ctx.data.npo === true) {
        await npoMembership.create({
          userId: user.id
        }, {
          transaction
        })
      }

      await Rat.create({
        name: name,
        platform: platform,
        userId: user.id
      }, {
        transaction
      })

      nickname = nickname.replace(/\[.*]/i, '')

      if (!ircPassword) {
        ircPassword = password
      }
      await NickServ.register(nickname, ircPassword, email)

      await User.update({ nicknames: [nickname] }, {
        where: { id: user.id },
        transaction
      })

      await transaction.commit()
    } catch (ex) {
      transaction.rollback()
      throw ex
    }

    let userQuery = new UserQuery({ id: userId }, ctx)
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
    process.emit('registration', ctx, ctx.data)
    let presentedUser = Users.presenter.render(result.rows, API.meta(result, userQuery))
    await HostServ.update(presentedUser)
    ctx.body = presentedUser
  }
}

process.on('registration', (ctx, values) => {
  BotServ.say(global.MODERATOR_CHANNEL,
    `[API] User with email ${values.email} registered. IRC Nickname: ${values.nickname}. CMDR name: ${values.name}`)
})