import { User, Rat, db, npoMembership } from '../db'
import axios from 'axios'
import config from '../../config'
import { UnauthorizedAPIError } from '../classes/APIError'

import API, {
  POST,
  required
} from '../classes/API'
import Profile from './Profiles'
import { ConflictAPIError, UnprocessableEntityAPIError } from '../classes/APIError'

const googleRecaptchaEndpoint = 'https://www.google.com/recaptcha/api/siteverify'

const platforms = ['pc', 'xb', 'ps']

export default class Register extends API {
  @POST('/register')
  @required('email', 'password', 'name', 'platform', 'nickname')
  async create (ctx) {
    let userId = undefined
    let { email, name, nickname, password, ircPassword, platform, 'g-recaptcha-response': captcha } = ctx.data

    const validationResponse = await axios.post(googleRecaptchaEndpoint, {
      secret:  config.recaptcha.secret,
      response: captcha,
      remoteip: ctx.inet
    })

    if (validationResponse.data.success !== true) {
      throw new UnauthorizedAPIError('/data/attributes/g-recaptcha-response')
    }

    await Register.checkExisting(ctx)

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
      await transaction.rollback()
      throw ex
    }

    let userQuery = new Query({params: { id: userId }, connection: ctx})
    let result = await User.scope('profile').findAndCountAll(userQuery.toSequelize)
    process.emit('registration', ctx, ctx.data)
    ctx.body = Profile.presenter.render(result.rows, API.meta(result, userQuery))
  }

  static async checkExisting (ctx) {
    let { email, name, platform } = ctx.data

    let existingUser = await User.findOne({ where: {
      email: {
        ilike: email
      }
    }})
    if (existingUser) {
      throw new ConflictAPIError({ pointer: '/data/attributes/email' })
    }

    let existingRat = await Rat.findOne({ where: {
      name: {
        ilike: name
      },
      platform: platform
    }})
    if (existingRat) {
      throw new ConflictAPIError({ pointer: '/data/attributes/name' })
    }
  }
}

