import { Op } from 'sequelize'
import { UnsupportedMediaAPIError } from '../classes/APIError'
import Anope from '../classes/Anope'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Group, User, UserGroups } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import logger, { logMetric } from '../logging'
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
 * Whether two channel-access maps are equivalent (order-insensitive).
 * @param {object} [a] a group's `channels` map
 * @param {object} [b] another group's `channels` map
 * @returns {boolean} true if they hold the same channel→flags entries
 */
function channelsEqual (a = {}, b = {}) {
  const keysA = Object.keys(a).sort()
  const keysB = Object.keys(b).sort()
  return keysA.length === keysB.length
    && keysA.every((key, index) => keysB[index] === key && a[key] === b[key])
}

/**
 * Fan a group-definition change out to its members immediately (Risk 47).
 *
 * A channel-access change enqueues a coalesced groupsync push per member; a
 * vhost change reapplies each member's vhost (HostServ-managed, so it rides the
 * legacy vhost writer rather than groupsync). Members are (re)loaded by group id
 * *after* the mutation so their merged access reflects the new definition, which
 * also covers deletion (the join rows survive a paranoid soft-delete). Runs in
 * the background and never rejects — large groups (e.g. `verified`) are paced by
 * the outbox worker and self-correct on login for the offline majority.
 * @param {object} arg options
 * @param {string} arg.groupId the affected group's id
 * @param {boolean} arg.channelsChanged whether channel access changed
 * @param {boolean} arg.vhostChanged whether the vhost changed
 * @returns {Promise<void>} resolves once the fan-out has been dispatched
 */
async function fanOutGroupChange ({ groupId, channelsChanged, vhostChanged }) {
  if (!channelsChanged && !vhostChanged) {
    return
  }

  try {
    const memberships = await UserGroups.findAll({ where: { groupId }, attributes: ['userId'] })
    const userIds = memberships.map((membership) => membership.userId)
    if (userIds.length === 0) {
      return
    }

    const members = await User.findAll({ where: { id: { [Op.in]: userIds } } })
    for (const member of members) {
      try {
        if (channelsChanged) {
          await Anope.enqueueGroupSync(member.email)
        }
        if (vhostChanged) {
          await Anope.updateVhost(member)
        }
      } catch (error) {
        logger.error({ message: 'groupsync group fan-out failed for a member', error })
      }
    }
  } catch (error) {
    logger.error({ message: 'groupsync group fan-out failed', error })
  }
}

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

  /** @summary Search groups */
  @GET('/groups')
  @websocket('groups', 'search')
  @authenticated
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Group.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /** @summary Get group by ID */
  @GET('/groups/:id')
  @websocket('groups', 'read')
  @parameters('id')
  @authenticated
  async read (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Group })

    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /** @summary Create group */
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

  /** @summary Update group */
  @PUT('/groups/:id')
  @websocket('groups', 'update')
  @parameters('id')
  @authenticated
  @permissions('groups.write')
  async update (ctx) {
    const existing = await Group.findByPk(ctx.params.id)
    const before = existing
      ? { channels: existing.channels, vhost: existing.vhost, withoutPrefix: existing.withoutPrefix }
      : null

    const result = await super.update({ ctx, databaseType: Group, updateSearch: { id: ctx.params.id } })

    // Log group update metrics
    logMetric('group_updated', {
      _group_id: result.id,
      _updated_by_user_id: ctx.state.user.id,
      _permissions_count: result.permissions?.length || 0,
    }, `Permission group updated: ${result.id} by admin ${ctx.state.user.id}`)

    if (before) {
      // Fire-and-forget so a large group's fan-out doesn't block the response.
      fanOutGroupChange({
        groupId: result.id,
        channelsChanged: !channelsEqual(before.channels, result.channels),
        vhostChanged: before.vhost !== result.vhost || before.withoutPrefix !== result.withoutPrefix,
      })
    }

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: GroupView })
  }

  /** @summary Delete group */
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

      // Removing the group strips its channels and (possibly) vhost from every
      // member — resync all of them. Fire-and-forget; the join rows survive the
      // soft-delete so members still resolve by group id.
      fanOutGroupChange({ groupId: group.id, channelsChanged: true, vhostChanged: true })
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

