import API, { GET, PUT, POST, DELETE, authenticated, required } from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Anope from '../classes/Anope'
import AnopeQuery from '../query2/Anope'
import AnopeDocument from '../Documents/Anope'
import NicknameView from '../views/Nickname'
import { NotFoundAPIError } from '../classes/APIError'
import { DocumentViewType } from '../Documents'

export default class Nickname extends API {
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
  async create (ctx) {

  }

  @PUT('/nicknames/:nick')
  @websocket('nicknames', 'update')
  async update (ctx) {

  }

  @DELETE('/nicknames/:nick')
  @websocket('nicknames', 'delete')
  async delete (ctx) {

  }
}
