import { User, Rat, db, npoMembership } from '../db'
import axios from 'axios'
import config from '../../config'
import Anope from '../classes/Anope'
import Verifications from './Verifications'
import Sessions from './Sessions'

import API, {
  POST,
  required
} from '../classes/API'
import { ConflictAPIError, UnprocessableEntityAPIError, UnauthorizedAPIError } from '../classes/APIError'

const googleRecaptchaEndpoint = 'https://www.google.com/recaptcha/api/siteverify'

const platforms = ['pc', 'xb', 'ps']

export default class Register extends API {
  @POST('/register')
  @required('email', 'password', 'name', 'platform', 'nickname', 'g-recaptcha-response')
  async create (ctx) {
    const { email, name, nickname, password, platform, 'g-recaptcha-response': captcha } = ctx.data

    const validationResponse = await axios.post(googleRecaptchaEndpoint, {
      secret:  config.recaptcha.secret,
      response: captcha,
      remoteip: ctx.request.ip
    })

    if (validationResponse.data.success !== true) {
      throw new UnauthorizedAPIError('/data/attributes/g-recaptcha-response')
    }

    await Register.checkExisting(ctx)

    const result = db.transaction(async (transaction) => {
      const user = await User.create({
        email,
        password
      }, { transaction })

      if (platforms.includes(platform) === false) {
        throw new UnprocessableEntityAPIError({
          pointer: '/data/attributes/platform'
        })
      }

      if (ctx.data.npo === true) {
        await npoMembership.create({
          userId: user.id
        }, { transaction })
      }

      const rat = await Rat.create({
        name,
        platform,
        userId: user.id
      }, { transaction })

      user.rats.push(rat)

      await Anope.addNewUser(email, nickname, `bcrypt:${user.password}`)
      await Verifications.createVerification(user, transaction)

      return Sessions.createVerifiedSession(ctx, user, transaction)
    })

    ctx.response.status = 201
    return true
  }

  static async checkExisting (ctx) {
    const { email, name, platform } = ctx.data

    const existingUser = await User.findOne({ where: {
      email: {
        ilike: email
      }
    } })
    if (existingUser) {
      throw new ConflictAPIError({ pointer: '/data/attributes/email' })
    }

    const existingRat = await Rat.findOne({ where: {
      name: {
        ilike: name
      },
      platform
    } })
    if (existingRat) {
      throw new ConflictAPIError({ pointer: '/data/attributes/name' })
    }
  }
}

