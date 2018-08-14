import { User, Rat, db, npoMembership } from '../db'
import NickServ from '../Anope/NickServ'
import HostServ from '../Anope/HostServ'
import BotServ from '../Anope/BotServ'
import UserQuery from '../query/UserQuery'
import API, {
  POST,
  required
} from '../classes/API'
import Profile from './Profiles'
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
    Register.checkExisting(ctx)

    let transaction = await db.transaction()

    try {
      let user = await User.create({
        email: email,
        password: password
      }, { transaction })

      userId = user.id

      await user.addGroup('default', { transaction })

      name = name.replace(/CMDR/i, '')
      if (platforms.includes(platform) === false) {
        // noinspection ExceptionCaughtLocallyJS
        throw new UnprocessableEntityAPIError({
          pointer: '/data/attributes/platform'
        })
      }

      if (ctx.data.npo === true) {
        await npoMembership.create({
          userId: user.id
        }, { transaction })
      }

      await Rat.create({
        name: name,
        platform: platform,
        userId: user.id
      }, { transaction })

      nickname = nickname.replace(/\[.*]/i, '')

      if (!ircPassword) {
        ircPassword = password
      }

      await User.update({ nicknames: [nickname] }, {
        where: { id: user.id }, transaction })

      await transaction.commit()
    } catch (ex) {
      transaction.rollback()
      throw ex
    }

    let userQuery = new UserQuery({query: { id: userId }, connection: ctx})
    let result = await User.scope('profile').findAndCountAll(userQuery.toSequelize)
    process.emit('registration', ctx, ctx.data)
    let presentedUser = Profile.presenter.render(result.rows, API.meta(result, userQuery))
    ctx.body = presentedUser
  }

  static async checkExisting (ctx) {
    let { email, name, platform } = ctx.data

    let existingUser = await User.findOne({ where: {
      email: {
        $iLike: email
      }
    }})
    if (existingUser) {
      throw new ConflictAPIError({ pointer: '/data/attributes/email' })
    }

    let existingRat = await Rat.findOne({ where: {
      name: {
        $iLike: name
      },
      platform: platform
    }})
    if (existingRat) {
      throw new ConflictAPIError({ pointer: '/data/attributes/name' })
    }
  }
}

process.on('registration', (ctx, values) => {
})
