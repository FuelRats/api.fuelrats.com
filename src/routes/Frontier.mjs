import DatabaseDocument from '../Documents/DatabaseDocument'
import { ConflictAPIError, UnauthorizedAPIError } from '../classes/APIError'
import Anope from '../classes/Anope'
import FrontierAPI from '../classes/FrontierAPI'
import Sessions from '../classes/Sessions'
import StatusCode from '../classes/StatusCode'
import config from '../config'
import { db, Rat, Token, User } from '../db'
import DatabaseQuery from '../query/DatabaseQuery'
import { TokenView } from '../view'
import API, { POST, getJSONAPIData } from './API'
import { oAuthTokenGenerator } from '../classes/TokenGenerators'

/**
 * Endpoint for managing Frontier based single sign-on
 */
export default class Frontier extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'frontier-logins'
  }

  /**
   * Login with a frontier token
   * @endpoint
   */
  @POST('/frontier/login')
  async login (ctx) {
    const { code } = getJSONAPIData({ ctx, type: 'frontier-logins' }).attributes
    const { access_token: token } = await FrontierAPI.exchangeToken(code)

    const profile = await FrontierAPI.getProfile(token)

    const existingLink = await User.findOne({
      where: {
        frontierId: profile.customer_id,
      },
    })

    if (existingLink) {
      const newToken = await Token.create({
        value: await oAuthTokenGenerator(),
        clientId: config.frontned.clientId,
        userId: existingLink.id,
        scope: ['*'],
      })

      ctx.status.code = StatusCode.created

      const query = new DatabaseQuery({ connection: ctx })
      return new DatabaseDocument({ query, newToken, type: TokenView })
    }

    const platform = Frontier.convertPlatform(profile.platform)

    const user = await User.findOne({
      where: {
        or: [{
          email: { ilike: profile.email },
        }, {
          and: {
            name: { ilike: profile.commander.name },
            platform,
          },
        }],
      },
    })

    if (user && !ctx.state.user) {
      throw new UnauthorizedAPIError({})
    }

    if (!user) {
      const creationRequest = {
        token,
        name: profile.commander.name,
        platform,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const query = new DatabaseQuery({ connection: ctx })
      return new DatabaseDocument({ query, creationRequest, type: TokenView })
    }

    db.transaction(async (transaction) => {
      if (user && ctx.state.user) {
        await user.update({
          frontierId: profile.customer_id,
        }, { transaction })

        const matchingRat = user.rats.find((rat) => {
          return rat.name.toLowerCase() === profile.commander.name.toLowerCase() && rat.platform === platform
        })

        if (matchingRat) {
          await matchingRat.update({
            frontierId: profile.commander.id,
          }, { transaction })
        } else {
          await Rat.create({
            name: profile.commander.name,
            platform,
            userId: user.id,
            frontierId: profile.commander.id,
          }, { transaction })
        }
      }

      await user.addGroup('verified', { transaction })
      return Sessions.createVerifiedSession(ctx, user, transaction)
    })

    const newToken = await Token.create({
      value: await oAuthTokenGenerator(),
      clientId: config.frontend.clientId,
      userId: user.id,
      scope: ['*'],
    })

    ctx.status.code = StatusCode.created
    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, newToken, type: TokenView })
  }

  /**
   * Create a linked frontier account
   * @endpoint
   */
  @POST('/frontier/create')
  async create (ctx) {
    const { token, nickname, password } = getJSONAPIData({ ctx, type: 'user' }).attributes
    const profile = await FrontierAPI.getProfile(token)

    const existingLink = await User.findOne({
      where: {
        frontierId: profile.customer_id,
      },
    })

    if (existingLink) {
      throw new ConflictAPIError()
    }

    const platform = Frontier.convertPlatform(profile.platform)

    const existingUser = await User.findOne({
      where: {
        or: [{
          email: { ilike: profile.email },
        }, {
          and: {
            name: { ilike: profile.commander.name },
            platform,
          },
        }],
      },
    })

    if (existingUser) {
      throw new ConflictAPIError()
    }

    const newUser = await db.transaction(async (transaction) => {
      const user = await User.create({
        email: profile.email,
        password,
        frontierId: profile.customer_id,
      }, { transaction })

      await Rat.create({
        name: profile.commander.name,
        platform,
        userId: user.id,
        frontierId: profile.commander.id,
      }, { transaction })


      await Anope.addNewUser(profile.email, nickname, `bcrypt:${user.password}`)
      await user.addGroup('verified', {
        transaction,
      })
      await Sessions.createVerifiedSession(ctx, user, transaction)
      return user
    })

    const newToken = await Token.create({
      value: await oAuthTokenGenerator(),
      clientId: config.ropcClientId,
      userId: newUser.id,
      scope: ['*'],
    })

    ctx.status.code = StatusCode.created
    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, newToken, type: TokenView })
  }

  /**
   * Convert a game platform from Frontier's platform types, to Fuel Rats platform types
   * @param {string} frontierPlatform Frontier platform type
   * @returns {string} fuel rats platform type
   */
  static convertPlatform (frontierPlatform) {
    return {
      steam: 'pc',
      frontier: 'pc',
      xbox: 'xb',
      psn: 'ps',
    }[frontierPlatform]
  }
}
