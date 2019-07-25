import API, { GET, PUT, POST, DELETE, authenticated, required, getJSONAPIData } from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Anope from '../classes/Anope'
import AnopeQuery from '../query/AnopeQuery'
import AnopeDocument from '../Documents/AnopeDocument'
import NicknameView from '../views/NicknameView'
import { ConflictAPIError, NotFoundAPIError } from '../classes/APIError'
import { DocumentViewType } from '../Documents/Document'

export default class Nickname extends API {
  get type () {
    return 'nicknames'
  }

  @GET('/nicknames')
  @websocket('nicknames', 'search')
  @authenticated
  async search (ctx) {
    const { nick } = ctx.query
    const result = await Anope.findAccountFuzzyMatch(nick)
    const query = new AnopeQuery({ connection: ctx })
    return new AnopeDocument({ query, result, type: NicknameView })
  }

  @GET('/nicknames/:nick')
  @websocket('nicknames', 'read')
  @authenticated
  async findById (ctx) {
    const { nick } = ctx.params
    const result = await Anope.findNickname(nick)
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    const query = new AnopeQuery({ connection: ctx })
    return new AnopeDocument({ query, result, type: NicknameView, view: DocumentViewType.individual })
  }

  @POST('/nicknames')
  @websocket('nicknames', 'create')
  @authenticated
  async create (ctx) {
    const { nick } = getJSONAPIData({ ctx, type: this.type })
    const existingNick = Anope.findNickname(nick)
    if (existingNick) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nick' })
    }

    const encryptedPassword = `bcrypt:${ctx.state.user.password}`

    await Anope.addNewUser(ctx.state.user.email, nick, encryptedPassword, ctx.state.user.vhost)

    const createdNick = Anope.findNickname(nick)
    const query = new AnopeQuery({ connection: ctx })
    ctx.response.status = 201
    return new AnopeDocument({ query, result: createdNick, type: NicknameView, view: DocumentViewType.individual })
  }

  @DELETE('/nicknames/:nick')
  @websocket('nicknames', 'delete')
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

    this.requireWritePermission({ connection: ctx, nickname })
    await Anope.removeNickname(nick)
    ctx.response.status = 204
    return true
  }

  getReadPermissionFor ({ connection, entity }) {
    if (entity.user.id === connection.state.user.id) {
      return ['nickname.write', 'nickname.write.me']
    }
    return ['nickname.write']
  }

  getWritePermissionFor ({ connection, entity }) {
    if (entity.user.id === connection.state.user.id) {
      return ['nickname.write', 'nickname.write.me']
    }
    return ['nickname.write']
  }
}
