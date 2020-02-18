import { DocumentViewType } from '../Documents'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { UnsupportedMediaAPIError } from '../classes/APIError'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Rat } from '../db'

import DatabaseQuery from '../query/DatabaseQuery'
import { RatView, UserView } from '../view'
import {
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
  parameters,
  WritePermission,
} from './API'
import APIResource from './APIResource'

/**
 * Endpoint for managing rats
 */
export default class Rats extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'rats'
  }

  /**
   * Search rats
   * @endpoint
   */
  @GET('/rats')
  @websocket('rats', 'search')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Rat.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: RatView })
  }

  /**
   * Get a rat by id
   * @endpoint
   */
  @GET('/rats/:id')
  @websocket('rats', 'read')
  @parameters('id')
  async findById (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Rat })

    return new DatabaseDocument({ query, result, type: RatView })
  }

  /**
   * Create a rat
   * @endpoint
   */
  @POST('/rats')
  @websocket('rats', 'create')
  @authenticated
  async create (ctx) {
    const result = await super.create({
      ctx,
      databaseType: Rat,
      overrideFields: {
        userId: ctx.state.user.id,
      },
    })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: RatView })
  }

  /**
   * Update a rat by id
   * @endpoint
   */
  @PUT('/rats')
  @websocket('rats', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Rat, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView })
  }

  /**
   * Delete a rat by id
   * @endpoint
   */
  @DELETE('/rats/:id')
  @websocket('rats', 'delete')
  @authenticated
  @parameters('id')
  async delete (ctx) {
    await super.delete({
      ctx,
      databaseType: Rat.scope('rescues'),
      hasPermission: (entity) => {
        if (Permission.granted({ permissions: ['rats.write'], connection: ctx })) {
          return true
        }

        if (entity.userId !== ctx.state.user.id) {
          return false
        }

        return entity.ships.length === 0 && entity.rescues.length === 0 && entity.firstLimpet.length === 0
      },
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a rat's user
   * @endpoint
   */
  @GET('/rats/:id/relationships/user')
  @websocket('rats', 'user', 'read')
  @authenticated
  async relationshipUserView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Rat,
      relationship: 'user',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Set a rat's user
   * @endpoint
   */
  @PATCH('/rats/:id/relationships/user')
  @websocket('rats', 'user', 'patch')
  @authenticated
  async relationshipUserPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Rat,
      change: 'patch',
      relationship: 'user',
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
      data: WritePermission.group,
      platform: WritePermission.group,
      frontierId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal,
    }
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    if (entity.userId === ctx.state.user.id) {
      return Permission.granted({ permissions: ['rat.write.me'], connection: ctx })
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

        hasPermission (connection) {
          return Permission.granted({ permissions: ['rats.write'], connection })
        },

        patch ({ entity, id }) {
          return entity.setUser(id)
        },
      }
    }

    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {
      user: 'users',
    }
  }
}
