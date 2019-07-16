

import { Rat, Rescue } from '../db'
import { CustomPresenter } from '../classes/Presenters'
import Ships from './Ships'
import { NotFoundAPIError } from '../classes/APIError'

import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  protect, WritePermission
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import DatabaseQuery from '../query2/Database'
import DatabaseDocument from '../Documents/Database'
import RatView from '../views/Rat'
import RescueView from '../views/Rescue'

export default class Rats extends API {
  @GET('/rats')
  @websocket('rats', 'search')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Rat.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: RatView })
  }

  @GET('/rats/:id')
  @websocket('rats', 'read')
  @parameters('id')
  async findById (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Rat.findOne({
      where: {
        id: ctx.params.id
      }
    })
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    return new DatabaseDocument({ query, result, type: RatView })
  }

  @POST('/rats')
  @websocket('rats', 'create')
  @authenticated
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: Rat })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = 201
    return new DatabaseDocument({ query, result, type: RatView })
  }

  @PUT('/rats')
  @websocket('rats', 'update')
  @authenticated
  @parameters('id')
  @protect('rat.write', 'platform')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Rat, updateSearch: { id:ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView })
  }

  @DELETE('/rats/:id')
  @websocket('rats', 'delete')
  @authenticated
  @permissions('rat.delete')
  @parameters('id')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Rat })

    ctx.response.status = 204
    return true
  }

  get writePermissionsForFieldAccess () {
    return {
      name: WritePermission.group,
      data: WritePermission.group,
      platform: WritePermission.group,
      frontierId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal
    }
  }

  getReadPermissionFor ({ connection, entity }) {
    if (entity.userId === connection.state.user.id) {
      return ['rat.write', 'rat.write.me']
    }
    return ['rat.write']
  }

  getWritePermissionFor ({ connection, entity }) {
    if (entity.userId === connection.state.user.id) {
      return ['rat.write', 'rat.write.me']
    }
    return ['rat.write']
  }
}
