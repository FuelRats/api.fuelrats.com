
import {
  GET,
  PUT,
  POST,
  DELETE,
  authenticated,
  permissions,
  WritePermission
} from './API'
import APIResource from './APIResource'

import { Group } from '../db'
import { websocket } from '../classes/WebSocket'
import DatabaseQuery from '../query/DatabaseQuery'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { GroupView } from '../view'
import StatusCode from '../classes/StatusCode'
import { UnsupportedMediaAPIError } from '../classes/APIError'

/**
 * Endpoints for managing user permission groups
 */
export default class Groups extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'groups'
  }

  /**
   * Search user groups
   * @endpoint
   */
  @GET('/groups')
  @websocket('groups', 'search')
  @authenticated
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Group.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /**
   * Get user group byi d
   * @endpoint
   */
  @GET('/groups/:id')
  @websocket('groups', 'read')
  @authenticated
  async read (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Group })

    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /**
   * Create a user permission group
   * @endpoint
   */
  @POST('/groups')
  @websocket('groups', 'create')
  @authenticated
  @permissions('groups.write')
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: Group, allowId: true })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /**
   * Update a user permission group
   * @endpoint
   */
  @PUT('/groups/:id')
  @websocket('groups', 'update')
  @authenticated
  @permissions('groups.write')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Group, updateSearch: { id:ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /**
   * Delete a user permission group
   * @endpoint
   */
  @DELETE('/groups/:id')
  @websocket('groups', 'delete')
  @authenticated
  @permissions('groups.write')
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Group })

    ctx.response.status = StatusCode.noContent
    return true
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
  isSelf () {
    return false
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {}
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      vhost: WritePermission.sudo,
      withoutPrefix: WritePermission.sudo,
      priority: WritePermission.sudo,
      permissions: WritePermission.sudo,
      channels: WritePermission.sudo,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal
    }
  }
}

