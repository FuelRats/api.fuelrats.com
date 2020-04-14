import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import {
  BadRequestAPIError,
  ConflictAPIError,
  NotFoundAPIError,
  UnprocessableEntityAPIError
} from '../classes/APIError'
import Anope from '../classes/Anope'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Rat, User } from '../db'
import AnopeQuery from '../query/AnopeQuery'
import DatabaseQuery from '../query/DatabaseQuery'
import { NicknameView, UserView } from '../view'
import API, {
  GET,
  POST,
  DELETE,
  authenticated,
  getJSONAPIData,
  PATCH, parameters
} from './API'
import Decals from './Decals'

/**
 * Endpoint for managing IRC nicknames
 */
export default class Nickname extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'nicknames'
  }

  /**
   * Search nicknames
   * @endpoint
   */
  @GET('/nicknames')
  @websocket('nicknames', 'search')
  @authenticated
  async search (ctx) {
    const { nick } = ctx.query
    if (!nick) {
      throw new BadRequestAPIError({
        parameter: 'nick',
      })
    }

    const result = await Anope.findAccountFuzzyMatch(nick)
    const query = new AnopeQuery({ connection: ctx })
    return new ObjectDocument({ query, result, type: NicknameView })
  }

  /**
   * Get info about a nickname
   * @endpoint
   */
  @GET('/nicknames/:nick')
  @websocket('nicknames', 'read')
  @parameters('nick')
  @authenticated
  async findById (ctx) {
    const { nick } = ctx.params
    const result = await Anope.findNickname(nick)
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    const query = new AnopeQuery({ connection: ctx })
    return new ObjectDocument({ query, result, type: NicknameView, view: DocumentViewType.individual })
  }

  /**
   * Register a nickname
   * @endpoint
   */
  @POST('/nicknames')
  @websocket('nicknames', 'create')
  @authenticated
  async create (ctx) {
    const { nick, ratId } = getJSONAPIData({ ctx, type: this.type }).attributes
    if (!nick) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/nick',
      })
    }

    const existingNick = await Anope.findNickname(nick)
    if (existingNick) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nick' })
    }

    const encryptedPassword = `bcrypt:${ctx.state.user.password}`

    await Anope.addNewUser({
      email: ctx.state.user.email,
      nick,
      encryptedPassword,
      vhost: ctx.state.user.vhost(),
      ratId,
    })

    const createdNick = await Anope.findNickname(nick)
    const query = new AnopeQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new ObjectDocument({ query, result: createdNick, type: NicknameView, view: DocumentViewType.individual })
  }

  /**
   * Drop a nickname
   * @endpoint
   */
  @DELETE('/nicknames/:nick')
  @websocket('nicknames', 'delete')
  @parameters('nick')
  @authenticated
  async delete (ctx) {
    const { nick } = ctx.params
    const nickname = await Anope.findNickname(nick)
    if (!nickname) {
      throw new NotFoundAPIError({ parameter: 'nick' })
    }

    if (nickname.display === nickname.nick) {
      throw new ConflictAPIError({ parameter: 'nick' })
    }

    this.requireWritePermission({ connection: ctx, entity: nickname })
    await Anope.removeNickname(nick)
    ctx.response.status = StatusCode.noContent
    return true
  }

  @GET('/nicknames/:nick/relationships/user')
  @websocket('nicknames', 'user', 'read')
  @parameters('nick')
  @authenticated
  async relationshipUserView (ctx) {
    const { nick } = ctx.params
    const nickname = await Anope.findNickname(nick)
    if (!nickname) {
      throw new NotFoundAPIError({ parameter: 'nick' })
    }


    const user = await User.findOne({
      where: {
        email: { iLike: nickname.email },
      },
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result: user, type: UserView })
  }

  /**
   * Get a nicknames' linked rat relationship
   * @endpoint
   */
  @GET('/nicknames/:nick/relationships/rat')
  @websocket('nicknames', 'rat', 'read')
  @authenticated
  async relationshipDisplayRatView (ctx) {
    const nickname = await Anope.findNickname(ctx.params.nick)

    if (!nickname) {
      throw new NotFoundAPIError({ parameter: 'nick' })
    }

    let rat = undefined
    if (nickname.ratId) {
      rat = await Rat.findOne({
        where: { id: nickname.ratId },
      })
    }


    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result: rat, type: NicknameView, view: DocumentViewType.meta })
  }

  /**
   * Set a user's display rat relationship
   * @endpoint
   */
  @PATCH('/nicknames/:nick/relationships/rat')
  @websocket('nicknames', 'rat', 'patch')
  @authenticated
  async relationshipFirstLimpetPatch () {
    // const user = await this.relationshipChange({
    //   ctx,
    //   databaseType: User,
    //   change: 'patch',
    //   relationship: 'displayRat'
    // })
    //
    // const query = new DatabaseQuery({ connection: ctx })
    // const result = await Anope.mapNickname(user)
    //
    // return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.meta })
  }
}
