import { UnsupportedMediaAPIError } from '../classes/APIError'
import Event from '../classes/Event'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Rat } from '../db'
import { DocumentViewType } from '../Documents'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { logMetric } from '../logging'
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

    // Log rat creation metrics
    logMetric('rat_created', {
      _rat_id: result.id,
      _user_id: ctx.state.user.id,
      _rat_name: result.name,
      _platform: result.platform,
      _expansion: result.expansion || 'legacy',
    }, `Rat created: ${result.name} (${result.id}) by user ${ctx.state.user.id}`)

    Event.broadcast('fuelrats.userupdate', ctx.state.user, ctx.state.user.id, {})
    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: RatView })
  }

  /**
   * Update a rat by id
   * @endpoint
   */
  @PUT('/rats/:id')
  @websocket('rats', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Rat, updateSearch: { id: ctx.params.id } })

    // Log rat update metrics
    const updatedFields = Object.keys(ctx.data?.data?.attributes || {})
    logMetric('rat_updated', {
      _rat_id: result.id,
      _updated_by_user_id: ctx.state.user.id,
      _rat_owner_id: result.userId,
      _is_owner_update: result.userId === ctx.state.user.id,
      _updated_fields: updatedFields.join(','),
      _name_changed: updatedFields.includes('name'),
      _platform_changed: updatedFields.includes('platform'),
      _new_name: ctx.data?.data?.attributes?.name || result.name,
      _new_platform: ctx.data?.data?.attributes?.platform || result.platform,
    }, `Rat updated: ${result.name} (${result.id}) by user ${ctx.state.user.id}`)

    Event.broadcast('fuelrats.userupdate', ctx.state.user, result.userId, {})
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
    // Get the rat before deletion for metrics
    const rat = await Rat.scope('rescues').findByPk(ctx.params.id)
    
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

        return entity.rescues.length === 0 && entity.firstLimpet.length === 0
      },
    })

    // Log rat deletion metrics
    if (rat) {
      logMetric('rat_deleted', {
        _rat_id: rat.id,
        _deleted_by_user_id: ctx.state.user.id,
        _rat_owner_id: rat.userId,
        _is_owner_deletion: rat.userId === ctx.state.user.id,
        _rat_name: rat.name,
        _platform: rat.platform,
        _rescue_count: rat.rescues?.length || 0,
        _first_limpet_count: rat.firstLimpet?.length || 0,
      }, `Rat deleted: ${rat.name} (${rat.id}) by user ${ctx.state.user.id}`)
    }

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
  @parameters('id')
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
      expansion: WritePermission.group,
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
      return Permission.granted({ permissions: ['rats.write.me'], connection: ctx })
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

        patch ({ entity, id, transaction }) {
          return entity.setUser(id, { transaction })
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
