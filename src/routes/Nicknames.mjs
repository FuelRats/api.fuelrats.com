import Anope from '../classes/Anope'
import { isBlockedUsername } from '../helpers/usernameFilter'
import {
  BadRequestAPIError,
  ConflictAPIError,
  NotFoundAPIError,
  UnprocessableEntityAPIError, UnsupportedMediaAPIError,
} from '../classes/APIError'
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
  PUT,
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
   * @summary Search nicknames
   * @description Supports exact match via nick param or case-insensitive LIKE via filter[nick][iLike].
   */
  @GET('/nicknames')
  @websocket('nicknames', 'search')
  @authenticated
  async search (ctx) {
    const { nick, filter } = ctx.query
    const iLikePattern = filter?.nick?.iLike ?? filter?.nick?.ilike
    if (!nick && !iLikePattern) {
      throw new BadRequestAPIError({
        parameter: 'nick',
      })
    }

    const result = iLikePattern
      ? await Anope.searchAccountsByNickname(iLikePattern)
      : await Anope.findAccountsByNickname(nick)
    const query = new AnopeQuery({ connection: ctx })
    return new ObjectDocument({ query, result, type: NicknameView })
  }

  /**
   * @summary Get nickname by ID
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
   * @summary Register nickname
   * @description Admins with nicknames.write can provide a userId to register for another user.
   */
  @POST('/nicknames')
  @websocket('nicknames', 'create')
  @authenticated
  async create (ctx) {
    const { nick, ratId, userId } = getJSONAPIData({ ctx, type: this.type }).attributes
    if (!nick || IRCNickname.test(nick) === false) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/nick',
      })
    }

    if (isBlockedUsername(nick)) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/nick',
        detail: 'This nickname is not allowed',
      })
    }

    // Determine target user — admin can specify userId to add nick to another user
    let targetUser = ctx.state.user
    if (userId && userId !== ctx.state.user.id) {
      if (!Permission.granted({ permissions: ['nicknames.write'], connection: ctx })) {
        throw new NotFoundAPIError({ parameter: 'userId' })
      }
      targetUser = await User.findByPk(userId)
      if (!targetUser) {
        throw new NotFoundAPIError({ pointer: '/data/attributes/userId' })
      }
    }

    const existingNick = await Anope.findNickname(nick)
    if (existingNick) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nick' })
    }

    const encryptedPassword = `bcrypt:${targetUser.password}`

    await Anope.addNewUser({
      email: targetUser.email,
      nick,
      encryptedPassword,
      vhost: targetUser.vhost(),
      ratId,
    })

    const createdNick = await Anope.findNickname(nick)
    const query = new AnopeQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new ObjectDocument({ query, result: createdNick, type: NicknameView, view: DocumentViewType.individual })
  }

  /**
   * @summary Set display nickname
   */
  @PUT('/nicknames/:id/display')
  @websocket('nicknames', 'display', 'update')
  @parameters('id')
  @authenticated
  async setDisplay (ctx) {
    const { id } = ctx.params
    const nickname = await Anope.findId(id)
    if (!nickname) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: nickname })

    const { displayNick } = getJSONAPIData({ ctx, type: this.type }).attributes
    if (!displayNick || IRCNickname.test(displayNick) === false) {
      throw new UnprocessableEntityAPIError({
        pointer: '/data/attributes/displayNick',
      })
    }

    // Set the display nickname using Anope
    await Anope.setDisplayNickname(nickname.email, displayNick)

    // Fetch the updated nickname info using the new display nick since the ID changes
    const updatedNickname = await Anope.findNickname(displayNick)
    const query = new AnopeQuery({ connection: ctx })
    return new ObjectDocument({ query, result: updatedNickname, type: NicknameView, view: DocumentViewType.individual })
  }

  /**
   * @summary Delete nickname
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

  /** @summary Get nickname's user relationship */
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

  /** @summary Get nickname's rat relationship */
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

  /** @summary Set nickname's rat relationship */
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
