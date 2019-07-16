import API, { POST, required, getJSONAPIData } from '../classes/API'
import FrontierAPI from '../classes/FrontierAPI'
import { db, Rat, Token, User } from '../db'
import crypto from 'crypto'
import config from '../../config'
import { ConflictAPIError, UnauthorizedAPIError } from '../classes/APIError'
import Sessions from './Sessions'
import DatabaseQuery from '../query2/Database'
import DatabaseDocument from '../Documents/Database'
import TokenView from '../views/Token'
import AccountCreationRequestView from '../views/AccountCreationRequest'
import Anope from '../classes/Anope'

export default class Frontier extends API {
  @POST('/frontier/login')
  async login (ctx) {
    const { code } = getJSONAPIData({ ctx, type: 'frontier-login' })
    const { access_token: token } = await FrontierAPI.exchangeToken(code)

    const profile = await FrontierAPI.getProfile(token)

    const existingLink = await User.findOne({
      where: {
        frontierId: profile.customer_id
      }
    })

    if (existingLink) {
      const newToken = await Token.create({
        value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
        clientId: config.ropcClientId,
        userId: existingLink.id,
        scope: ['*']
      })

      ctx.status.code = 201

      const query = new DatabaseQuery({ connection: ctx })
      return new DatabaseDocument({ query, newToken, type: TokenView })
    }

    const platform = Frontier.convertPlatform(profile.platform)

    const user = await User.findOne({
      where: {
        or: [{
          email: { ilike: profile.email }
        }, {
          and: {
            name: { ilike: profile.commander.name },
            platform
          }
        }]
      }
    })

    if (user && !ctx.state.user) {
      throw new UnauthorizedAPIError()
    }

    if (!user) {
      const creationRequest = {
        token,
        name: profile.commander.name,
        platform,
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const query = new DatabaseQuery({ connection: ctx })
      return new DatabaseDocument({ query, creationRequest, type: TokenView })
    }

    db.transaction(async (transaction) => {
      if (user && ctx.state.user) {
        await user.update({
          frontierId: profile.customer_id
        }, { transaction })

        const matchingRat = user.rats.find((rat) => {
          return rat.name.toLowerCase() === profile.commander.name.toLowerCase() && rat.platform === platform
        })

        if (matchingRat) {
          await matchingRat.update({
            frontierId: profile.commander.id
          }, { transaction })
        } else {
          await Rat.create({
            name: profile.commander.name,
            platform,
            userId: user.id,
            frontierId: profile.commander.id
          }, { transaction })
        }
      }

      await user.addGroup('verified', { transaction })
      return Sessions.createVerifiedSession(ctx, user, transaction)
    })

    const newToken = await Token.create({
      value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
      clientId: config.ropcClientId,
      userId: user.id,
      scope: ['*']
    })

    ctx.status.code = 201
    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, newToken, type: TokenView })
  }

  @POST('/frontier/create')
  async create (ctx) {
    const { token, nickname, password } = getJSONAPIData({ ctx, type: 'user' })
    const profile = await FrontierAPI.getProfile(token)

    const existingLink = await User.findOne({
      where: {
        frontierId: profile.customer_id
      }
    })

    if (existingLink) {
      throw new ConflictAPIError()
    }

    const platform = Frontier.convertPlatform(profile.platform)

    const existingUser = await User.findOne({
      where: {
        or: [{
          email: { ilike: profile.email }
        }, {
          and: {
            name: { ilike: profile.commander.name },
            platform
          }
        }]
      }
    })

    if (existingUser) {
      throw new ConflictAPIError()
    }

    const newUser = await db.transaction(async (transaction) => {
      const user = await User.create({
        email: profile.email,
        password,
        frontierId: profile.customer_id
      }, { transaction })

      await Rat.create({
        name: profile.commander.name,
        platform,
        userId: user.id,
        frontierId: profile.commander.id
      }, { transaction })


      await Anope.addNewUser(profile.email, nickname, `bcrypt:${user.password}`)
      await user.addGroup('verified', {
        transaction
      })
      await Sessions.createVerifiedSession(ctx, user, transaction)
      return user
    })

    const newToken = await Token.create({
      value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
      clientId: config.ropcClientId,
      userId: newUser.id,
      scope: ['*']
    })

    ctx.status.code = 201
    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, newToken, type: TokenView })
  }

  static convertPlatform (frontierPlatform) {
    return {
      steam: 'pc',
      frontier: 'pc',
      xbox: 'xb',
      psn: 'ps'
    }[frontierPlatform]
  }
}
