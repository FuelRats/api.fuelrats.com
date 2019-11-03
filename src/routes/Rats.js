

import { Rat} from '../db'
import { NotFoundAPIError, UnsupportedMediaAPIError } from '../classes/APIError'

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
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import StatusCode from '../classes/StatusCode'
import Permission from '../classes/Permission'
import { RatView } from '../view'

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
    ctx.response.status = StatusCode.created
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

    ctx.response.status = StatusCode.noContent
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

  /**
   * @inheritdoc
   */
  isInternal ({ ctx }) {
    return Permission.granted({ permissions: ['rat.internal'], user: ctx.state.user, scope: ctx.state.scope })
  }

  /**
   * @inheritdoc
   */
  isGroup ({ ctx }) {
    return Permission.granted({ permissions: ['rat.write'], user: ctx.state.user, scope: ctx.state.scope })
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    if (entity.userId === ctx.state.user.id) {
      return Permission.granted({ permissions: ['rat.write.me'], user: ctx.state.user, scope: ctx.state.scope })
    }
    return false
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

  /**
   *
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'user':
        return {
          many: false,

          add ({ entity, id }) {
            return entity.addUser(id)
          },

          patch ({ entity, id }) {
            return entity.setUser(id)
          },

          remove ({ entity, id }) {
            return entity.removeUser(id)
          }
        }

      default:
        throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
    }
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {
      'user': 'users'
    }
  }
}
