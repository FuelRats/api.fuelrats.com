import { Op } from 'sequelize'
import { BadRequestAPIError, NotFoundAPIError, UnsupportedMediaAPIError } from '../classes/APIError'
import Anope from '../classes/Anope'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { db, Group, User, UserGroups } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { isValidChannelKey } from '../helpers/GroupChannels'
import { VALID_FLAG_LETTERS } from '../helpers/groupFlagLetters'
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
 * Diff two channel-access maps for audit logging. A channel edit now grants
 * durable ChanServ modes to members via groupsync, so record exactly what moved.
 * @param {object} [before] the group's channels before the edit
 * @param {object} [after] the group's channels after the edit
 * @returns {{added: string[], removed: string[], changed: string[]}} the per-channel diff
 */
function channelDiff (before = {}, after = {}) {
  const added = Object.keys(after).filter((channel) => !(channel in before))
  const removed = Object.keys(before).filter((channel) => !(channel in after))
  const changed = Object.keys(after).filter((channel) => channel in before && before[channel] !== after[channel])
  return { added, removed, changed }
}

/**
 * Transactionally read-modify-write a single group's `channels` map, then log
 * the diff and fan out the change to members. `apply` mutates a copy of the map
 * (set or delete one key). The row is locked for the read-modify-write so
 * concurrent single-channel edits don't clobber each other; the model validator
 * runs on save (rejects invalid FLAGS as a 422).
 * @param {object} arg options
 * @param {Context} arg.ctx request context
 * @param {string} arg.groupId the group to edit
 * @param {(channels: object) => void} arg.apply mutation applied to the channels copy
 * @returns {Promise<DatabaseDocument>} the updated group document
 */
async function mutateGroupChannel ({ ctx, groupId, apply }) {
  const { group, before } = await db.transaction(async (transaction) => {
    const target = await Group.findByPk(groupId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!target) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const previous = { ...(target.channels ?? {}) }
    const channels = { ...previous }
    apply(channels)

    target.channels = channels
    target.changed('channels', true)
    await target.save({ transaction })
    return { group: target, before: previous }
  })

  const diff = channelDiff(before, group.channels)
  logMetric('group_updated', {
    _group_id: group.id,
    _updated_by_user_id: ctx.state.user.id,
    _permissions_count: group.permissions?.length || 0,
    _channels_added: diff.added,
    _channels_removed: diff.removed,
    _channels_changed: diff.changed,
  }, `Permission group channels updated: ${group.id} by admin ${ctx.state.user.id}`)

  // Fire-and-forget so a large group's fan-out doesn't block the response.
  fanOutGroupChange({
    groupId: group.id,
    channelsChanged: !channelsEqual(before, group.channels),
    vhostChanged: false,
  })

  const query = new DatabaseQuery({ connection: ctx })
  return new DatabaseDocument({ query, result: group, type: GroupView })
}

/**
 * Diff two permission (OAuth scope) lists for audit logging. Granting a scope to
 * a group grants it to every member's effective permissions, so record what moved.
 * @param {string[]} [before] the group's permissions before the edit
 * @param {string[]} [after] the group's permissions after the edit
 * @returns {{added: string[], removed: string[]}} the per-scope diff
 */
function permissionDiff (before = [], after = []) {
  const beforeSet = new Set(before)
  const afterSet = new Set(after)
  const added = after.filter((scope) => !beforeSet.has(scope))
  const removed = before.filter((scope) => !afterSet.has(scope))
  return { added, removed }
}

/**
 * Transactionally read-modify-write a single group's `permissions` array, then
 * log the diff. `apply` mutates a copy of the array (add or remove one scope).
 * The row is locked for the read-modify-write so concurrent single-scope edits
 * don't clobber each other; the model validator (`Permission.assertOAuthScopes`)
 * runs on save and rejects an invalid scope as a 422. Unlike a channel edit, a
 * permission change has no IRC side effect (scopes gate the API, not ChanServ),
 * so there is no member fan-out — effective permissions recompute per request.
 * @param {object} arg options
 * @param {Context} arg.ctx request context
 * @param {string} arg.groupId the group to edit
 * @param {(permissions: string[]) => void} arg.apply mutation applied to the permissions copy
 * @returns {Promise<DatabaseDocument>} the updated group document
 */
async function mutateGroupPermission ({ ctx, groupId, apply }) {
  const { group, before } = await db.transaction(async (transaction) => {
    const target = await Group.findByPk(groupId, { transaction, lock: transaction.LOCK.UPDATE })
    if (!target) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const previous = [...(target.permissions ?? [])]
    const permissions = [...previous]
    apply(permissions)

    target.permissions = permissions
    target.changed('permissions', true)
    await target.save({ transaction })
    return { group: target, before: previous }
  })

  const diff = permissionDiff(before, group.permissions)
  logMetric('group_updated', {
    _group_id: group.id,
    _updated_by_user_id: ctx.state.user.id,
    _permissions_count: group.permissions?.length || 0,
    _permissions_added: diff.added,
    _permissions_removed: diff.removed,
  }, `Permission group scopes updated: ${group.id} by admin ${ctx.state.user.id}`)

  const query = new DatabaseQuery({ connection: ctx })
  return new DatabaseDocument({ query, result: group, type: GroupView })
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

    // Log group update metrics, including the per-channel diff — a channel edit
    // now grants durable ChanServ modes to members via groupsync.
    const channels = channelDiff(before?.channels, result.channels)
    logMetric('group_updated', {
      _group_id: result.id,
      _updated_by_user_id: ctx.state.user.id,
      _permissions_count: result.permissions?.length || 0,
      _channels_added: channels.added,
      _channels_removed: channels.removed,
      _channels_changed: channels.changed,
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
   * @summary Add or update a single channel's access flags on a group
   * Body: `{ "flags": "OV" }` (or JSON:API `{ data: { attributes: { flags } } }`).
   * The `:channel` path segment is the bare channel key (no `#`).
   */
  @PUT('/groups/:id/channels/:channel')
  @websocket('groups', 'channels', 'set')
  @parameters('id', 'channel')
  @authenticated
  @permissions('groups.write')
  async setChannel (ctx) {
    const { channel } = ctx.params
    const flags = ctx.data?.flags ?? ctx.data?.data?.attributes?.flags

    if (!isValidChannelKey(channel)) {
      throw new BadRequestAPIError({ parameter: 'channel' })
    }
    if (typeof flags !== 'string' || flags.length === 0
      || ![...flags].every((letter) => VALID_FLAG_LETTERS.has(letter))) {
      throw new BadRequestAPIError({ pointer: '/flags' })
    }

    return mutateGroupChannel({
      ctx,
      groupId: ctx.params.id,
      apply: (channels) => {
        channels[channel] = flags
      },
    })
  }

  /**
   * @summary Remove a single channel from a group (idempotent)
   */
  @DELETE('/groups/:id/channels/:channel')
  @websocket('groups', 'channels', 'delete')
  @parameters('id', 'channel')
  @authenticated
  @permissions('groups.write')
  async deleteChannel (ctx) {
    return mutateGroupChannel({
      ctx,
      groupId: ctx.params.id,
      apply: (channels) => {
        delete channels[ctx.params.channel]
      },
    })
  }

  /**
   * @summary Grant a single OAuth permission scope to a group (idempotent)
   * The `:scope` path segment is the permission string (e.g. `rescues.write`).
   */
  @PUT('/groups/:id/permissions/:scope')
  @websocket('groups', 'permissions', 'set')
  @parameters('id', 'scope')
  @authenticated
  @permissions('groups.write')
  async setPermission (ctx) {
    const { scope } = ctx.params

    if (!Permission.isValidOAuthScope(scope)) {
      throw new BadRequestAPIError({ parameter: 'scope' })
    }

    return mutateGroupPermission({
      ctx,
      groupId: ctx.params.id,
      apply: (permissions) => {
        if (!permissions.includes(scope)) {
          permissions.push(scope)
        }
      },
    })
  }

  /**
   * @summary Revoke a single OAuth permission scope from a group (idempotent)
   */
  @DELETE('/groups/:id/permissions/:scope')
  @websocket('groups', 'permissions', 'delete')
  @parameters('id', 'scope')
  @authenticated
  @permissions('groups.write')
  async deletePermission (ctx) {
    const { scope } = ctx.params

    return mutateGroupPermission({
      ctx,
      groupId: ctx.params.id,
      apply: (permissions) => {
        const index = permissions.indexOf(scope)
        if (index !== -1) {
          permissions.splice(index, 1)
        }
      },
    })
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
      name: WritePermission.sudo,
      displayName: WritePermission.sudo,
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

