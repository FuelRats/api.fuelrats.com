import { UnsupportedMediaAPIError } from '../classes/APIError'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Group } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { logMetric } from '../logging'
import DatabaseQuery from '../query/DatabaseQuery'
import { GroupView } from '../view'
import {
  GET,
  PUT,
  POST,
  DELETE,
  authenticated,
  permissions,
  WritePermission,
  parameters,
} from './API'
import APIResource from './APIResource'


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
  @parameters('id')
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

    // Log group creation metrics
    logMetric('group_created', {
      _group_id: result.id,
      _created_by_user_id: ctx.state.user.id,
      _group_name: result.id,
      _permissions_count: result.permissions?.length || 0,
      _has_vhost: Boolean(result.vhost),
      _priority: result.priority || 0,
    }, `Permission group created: ${result.id} by admin ${ctx.state.user.id}`)

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
  @parameters('id')
  @authenticated
  @permissions('groups.write')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Group, updateSearch: { id: ctx.params.id } })

    // Log group update metrics
    logMetric('group_updated', {
      _group_id: result.id,
      _updated_by_user_id: ctx.state.user.id,
      _permissions_count: result.permissions?.length || 0,
    }, `Permission group updated: ${result.id} by admin ${ctx.state.user.id}`)

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /**
   * Delete a user permission group
   * @endpoint
   */
  @DELETE('/groups/:id')
  @websocket('groups', 'delete')
  @parameters('id')
  @authenticated
  @permissions('groups.write')
  async delete (ctx) {
    // Get the group before deletion for metrics
    const group = await Group.findByPk(ctx.params.id)

    await super.delete({ ctx, databaseType: Group })

    // Log group deletion metrics
    if (group) {
      logMetric('group_deleted', {
        _group_id: group.id,
        _deleted_by_user_id: ctx.state.user.id,
        _permissions_count: group.permissions?.length || 0,
      }, `Permission group deleted: ${group.id} by admin ${ctx.state.user.id}`)
    }

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
      deletedAt: WritePermission.internal,
    }
  }
}

