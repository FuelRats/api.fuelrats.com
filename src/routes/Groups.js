
import API, {
  GET,
  PUT,
  POST,
  DELETE,
  parameters,
  authenticated,
  permissions,
  required
} from '../classes/API'

import { Group, Rat, User } from '../db'
import { websocket } from '../classes/WebSocket'
import {NotFoundAPIError} from '../classes/APIError'
import Users from './Users'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { RatView, GroupView } from '../view'
import StatusCode from '../classes/StatusCode'

export default class Groups extends API {
  @GET('/groups')
  @websocket('groups', 'search')
  @authenticated
  @permissions('group.read')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Group.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  @GET('/groups/:id')
  @websocket('groups', 'read')
  @authenticated
  @permissions('group.read')
  @parameters('id')
  async read (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Group.findOne({
      where: {
        id: ctx.params.id
      }
    })
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  @POST('/groups')
  @websocket('groups', 'create')
  @authenticated
  @permissions('group.write')
  @required('id', 'priority', 'permissions')
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: Group })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  @PUT('/groups/:id')
  @websocket('groups', 'update')
  @authenticated
  @permissions('group.write')
  @parameters('id')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Group, updateSearch: { id:ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  @DELETE('/groups/:id')
  @websocket('groups', 'delete')
  @authenticated
  @permissions('group.delete')
  @parameters('id')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Group })

    ctx.response.status = StatusCode.noContent
    return true
  }
}

