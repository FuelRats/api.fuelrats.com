import { User, Rat, db, npoMembership } from '../db'
import axios from 'axios'
import config from '../../config'
import Anope from '../classes/Anope'
import Mail from '../classes/Mail'

import API, {
  POST,
  required
} from '../classes/API'
import { ConflictAPIError, UnprocessableEntityAPIError, UnauthorizedAPIError } from '../classes/APIError'

const mail = new Mail()

const googleRecaptchaEndpoint = 'https://www.google.com/recaptcha/api/siteverify'

const platforms = ['pc', 'xb', 'ps']

export default class Register extends API {
  @POST('/register')
  @required('email', 'password', 'name', 'platform', 'nickname', 'g-recaptcha-response')
  async create (ctx) {
    const { email, name, nickname, password, ircPassword, platform, 'g-recaptcha-response': captcha } = ctx.data

    const validationResponse = await axios.post(googleRecaptchaEndpoint, {
      secret:  config.recaptcha.secret,
      response: captcha,
      remoteip: ctx.inet
    })

    if (validationResponse.data.success !== true) {
      throw new UnauthorizedAPIError('/data/attributes/g-recaptcha-response')
    }

    await Register.checkExisting(ctx)

    const transaction = await db.transaction()

    try {
      const user = await User.create({
        email,
        password
      }, { transaction })

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
        name,
        platform,
        userId: user.id
      }, { transaction })

      await Anope.addNewUser(email, nickname, `bcrypt:${user.password}`)


      await mail.send({
        to: user.email,
        subject: 'Fuel Rats Email Verification Required',
        body: {
          name,
          intro: 'To complete the creation of your Fuel Rats Account your email address needs to be verified.',
          action: {
            instructions: 'Click the button below to verify your email:',
            button: {
              color: '#d65050',
              text: 'Verify me',
              link:  Resets.getResetLink(reset.value)
            }
          },
          goToAction: {
            text: 'Verify Email Address',
            link: Resets.getResetLink(reset.value),
            description: 'Click to verify your email'
          },
          outro: 'If you are having problems with verification you may contact support@fuelrats.com',
          signature: 'Sincerely'
        }
      })

      await transaction.commit()
    } catch (ex) {
      await transaction.rollback()
      throw ex
    }


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

