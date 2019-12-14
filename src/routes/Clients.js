import { Client, Code, Token } from '../db'
import crypto from 'crypto'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { ClientView, UserView } from '../view'
import { UnsupportedMediaAPIError } from '../classes/APIError'
import { Context } from '../classes/Context'
import {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
  parameters,
  WritePermission,
  APIResource
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import StatusCode from '../classes/StatusCode'
import Permission from '../classes/Permission'
import { DocumentViewType } from '../Documents'

const clientSecretLength = 32

/**
 * OAuth clients endpoints
 */
export default class Clients extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'clients'
  }

  /**
   * Search oauth clients
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} list of oauth client results
   */
  @GET('/clients')
  @websocket('clients', 'search')
  @authenticated
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Client.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  /**
   * Find an Oauth client by id
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} an oauth client result
   */
  @GET('/clients/:id')
  @websocket('clients', 'read')
  @authenticated
  @parameters('id')
  async findById (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Client })

    return new DatabaseDocument({ query, result, type: ClientView })
  }

  /**
   * Create an oauth client
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} created oauth client
   */
  @POST('/clients')
  @websocket('clients', 'create')
  @authenticated
  async create (ctx) {
    const secret = crypto.randomBytes(clientSecretLength).toString('hex')
    const result = await super.create({
      ctx,
      databaseType: Client,
      overrideFields: { secret, userId: ctx.state.user.id }
    })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  /**
   * Update a client by ID
   * @param {Context} ctx request context
   * @returns {Promise<DatabaseDocument>} updated oauth client
   */
  @PUT('/clients/:id')
  @websocket('clients', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Client, updateSearch: { id:ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: ClientView })
  }

  /**
   * Delete an oauth client by ID
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @DELETE('/clients/:id')
  @websocket('clients', 'delete')
  @authenticated
  @permissions('clients.write')
  @parameters('id')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Client })
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
  async relationshipUserView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Client,
      relationship: 'user'
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Set a client's user relationship
   * @param {Context} ctx request context
   * @returns {Promise<boolean>} 204 no content
   */
  @PATCH('/clients/:id/relationships/user')
  @websocket('clients', 'user', 'patch')
  @authenticated
  async relationshipUserPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Client,
      change: 'patch',
      relationship: 'user'
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * @inheritdoc
   */
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
  isSelf ({ ctx, entity }) {
    if (entity.userId === ctx.state.user.id) {
      return Permission.granted({ permissions: ['clients.write.me'], connection: ctx })
    }
    return false
  }

  /**
   *
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    if (relationship === 'user') {
      return {
        many: false,
        hasPermission (connection, entity, id) {
          return (!entity.userId && id === connection.state.user.id) || Permission.granted({
            permissions: ['clients.write'],
            connection
          })
        },

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
    }

    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
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
