import { Client, Rat, Code, Token } from '../db'
import crypto from 'crypto'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { ClientView } from '../view'
import { NotFoundAPIError, UnsupportedMediaAPIError } from '../classes/APIError'
import API, {
  Context,
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  disallow,
  required, WritePermission, PATCH
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import StatusCode from '../classes/StatusCode'
import Permission from '../classes/Permission'
import { DocumentViewType } from '../Documents'

const clientSecretLength = 32

export default class Clients extends API {
  @GET('/clients')
  @websocket('clients', 'search')
  @authenticated
  @permissions('client.read')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Client.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  @GET('/clients/:id')
  @websocket('clients', 'read')
  @authenticated
  @parameters('id')
  async findById (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Client.findOne({
      where: {
        id: ctx.params.id
      }
    })
    if (!result) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  @POST('/clients')
  @websocket('clients', 'create')
  @authenticated
  @required('name')
  @disallow('secret')
  async create (ctx) {
    const secret = crypto.randomBytes(clientSecretLength).toString('hex')
    const result = await super.create({ ctx, databaseType: Client, overrideFields: { secret } })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  @PUT('/clients/:id')
  @websocket('clients', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Client, updateSearch: { id:ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  @DELETE('/clients/:id')
  @websocket('clients', 'delete')
  @authenticated
  @permissions('client.delete')
  @parameters('id')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Rat })
    await Code.destroy({
      where: {
        clientId: ctx.params.id
      }
    })

    await Token.destroy({
      where: {
        clientId: ctx.params.id
      }
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a client's user relationship
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} a user's display rat relationship
   */
  @GET('/clients/:id/relationships/user')
  @websocket('clients', 'user', 'read')
  @authenticated
  async relationshipDisplayRatView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Client,
      relationship: 'user'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: ClientView, view: DocumentViewType.meta })
  }

  /**
   * Set a client's user relationship
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an updated user with updated relationships
   */
  @PATCH('/clients/:id/relationships/user')
  @websocket('clients', 'user', 'patch')
  @authenticated
  async relationshipFirstLimpetPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Client,
      change: 'patch',
      relationship: 'user'
    })

    const query = new DatabaseQuery({ connection: ctx })

    return new DatabaseDocument({ query, result, type: ClientView, view: DocumentViewType.meta })
  }

  get writePermissionsForFieldAccess () {
    return {
      name: WritePermission.group,
      redirectUri: WritePermission.group,
      secret: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal
    }
  }

  /**
   * @inheritdoc
   */
  isInternal ({ ctx }) {
    return Permission.granted({ permissions: ['client.internal'], user: ctx.state.user, scope: ctx.state.scope })
  }

  /**
   * @inheritdoc
   */
  isGroup ({ ctx }) {
    return Permission.granted({ permissions: ['client.write'], user: ctx.state.user, scope: ctx.state.scope })
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    if (entity.userId === ctx.state.user.id) {
      return Permission.granted({ permissions: ['client.write.me'], user: ctx.state.user, scope: ctx.state.scope })
    }
    return false
  }

  /**
   * @inheritdoc
   */
  getReadPermissionFor ({ connection, entity }) {
    if (entity.userId === connection.state.user.id) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
  }

  /**
   * @inheritdoc
   */
  getWritePermissionFor ({ connection, entity }) {
    if (entity.userId === connection.state.user.id) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
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
