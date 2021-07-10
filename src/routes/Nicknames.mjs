import Anope from '../classes/Anope'
import {
  BadRequestAPIError,
  ConflictAPIError,
  NotFoundAPIError,
  UnprocessableEntityAPIError, UnsupportedMediaAPIError,
} from '../classes/APIError'
import { Context } from '../classes/Context'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Rat, User } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import ObjectDocument from '../Documents/ObjectDocument'
import { IRCNickname } from '../helpers/Validators'
import AnopeQuery from '../query/AnopeQuery'
import DatabaseQuery from '../query/DatabaseQuery'
import { NicknameView, UserView } from '../view'
import {
  GET,
  POST,
  DELETE,
  authenticated,
  getJSONAPIData,
  PATCH, parameters,
} from './API'
import APIResource from './APIResource'

/**
 * Endpoint for managing IRC nicknames
 */
export default class Nickname extends APIResource {
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
  @GET('/nicknames/:id')
  @websocket('nicknames', 'read')
  @parameters('id')
  @authenticated
  async findById (ctx) {
    const { id } = ctx.params
    const result = await Anope.findId(id)
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
    if (!nick || IRCNickname.test(nick) === false) {
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
  @DELETE('/nicknames/:id')
  @websocket('nicknames', 'delete')
  @parameters('id')
  @authenticated
  async delete (ctx) {
    const { id } = ctx.params
    const nickname = await Anope.findId(id)
    if (!nickname) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    if (nickname.display === nickname.nick) {
      throw new ConflictAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: nickname })
    await Anope.removeNickname(nickname.nick)
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * @param {Context} ctx Request context
   * @returns {DatabaseDocument}
   */
  @GET('/nicknames/:id/relationships/user')
  @websocket('nicknames', 'user', 'read')
  @parameters('id')
  @authenticated
  async relationshipUserView (ctx) {
    const { id } = ctx.params
    const nickname = await Anope.findId(id)
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

  /**
   * @inheritdoc
   */
  changeRelationship () {
    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    if (entity.email.toLowerCase() === ctx.state.user.email.toLowerCase()) {
      return Permission.granted({ permissions: ['users.write.me'], connection: ctx })
    }
    return false
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return { }
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return undefined
  }
}
