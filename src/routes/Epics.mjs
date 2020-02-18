import { DocumentViewType } from '../Documents'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { UnsupportedMediaAPIError } from '../classes/APIError'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Epic } from '../db'
import DatabaseQuery from '../query/DatabaseQuery'
import { EpicView, UserView } from '../view'
import {
  GET,
  PUT,
  POST,
  PATCH,
  DELETE,
  authenticated,
  WritePermission,
} from './API'
import APIResource from './APIResource'

/**
 * Class managing epic nomination endpoints
 */
export default class Epics extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'epics'
  }

  /**
   * Search among all epic nominations
   * @endpoint
   */
  @GET('/epics')
  @websocket('epics', 'search')
  @authenticated
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Epic.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: EpicView })
  }

  /**
   * Get an Epic nomination by id
   * @endpoint
   */
  @GET('/epics/:id')
  @websocket('epics', 'read')
  @authenticated
  async read (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Epic })
    return new DatabaseDocument({ query, result, type: EpicView })
  }

  /**
   * Create an epic nomination
   * @endpoint
   */
  @POST('/epics')
  @websocket('epics', 'create')
  @authenticated
  async create (ctx) {
    this.requireRelationships({ ctx, relationships: ['nominees'] })

    const result = await super.create({
      ctx,
      databaseType: Epic,
      overrideFields: { nominatedById: ctx.state.user.id },
    })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: EpicView })
  }

  /**
   * Update an epic nomination
   * @endpoint
   */
  @PUT('/epics/:id')
  @websocket('epics', 'update')
  @authenticated
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Epic, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: EpicView })
  }

  /**
   * Delete an epic nomination
   * @endpoint
   */
  @DELETE('/epics/:id')
  @websocket('epics', 'delete')
  @authenticated
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Epic })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get the nominated users in an epic nomination
   * @endpoint
   */
  @GET('/epics/:id/relationships/nominees')
  @websocket('epics', 'nominees', 'read')
  @authenticated
  async relationshipNomineesView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Epic,
      relationship: 'nominees',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Add nominated rats in an epic nomination
   * @endpoint
   */
  @POST('/epics/:id/relationships/nominees')
  @websocket('epics', 'nominees', 'create')
  @authenticated
  async relationshipNomineesAdd (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Epic,
      change: 'add',
      relationship: 'nominees',
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Update the nominated rats in an epic nomination
   * @endpoint
   */
  @PATCH('/epics/:id/relationships/nominees')
  @websocket('epics', 'nominees', 'patch')
  @authenticated
  async relationshipNomineesPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Epic,
      change: 'patch',
      relationship: 'nominees',
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Delete the nominated rats in an epic nomination
   * @endpoint
   */
  @DELETE('/epics/:id/relationships/nominees')
  @websocket('epics', 'nominees', 'delete')
  @authenticated
  async relationshipNomineesDelete (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Epic,
      change: 'remove',
      relationship: 'nominees',
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get the user who nominated this epic
   * @endpoint
   */
  @GET('/epics/:id/relationships/nominatedBy')
  @websocket('epics', 'nominatedBy', 'read')
  @authenticated
  async relationshipNominatedByView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Epic,
      relationship: 'nominatedBy',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Set the user who nominated this epic
   * @endpoint
   */
  @PATCH('/epics/:id/relationships/nominatedBy')
  @websocket('epics', 'nominatedBy', 'patch')
  @authenticated
  async relationshipNominatedByPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Epic,
      change: 'patch',
      relationship: 'nominatedBy',
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get the user who approved this epic
   * @endpoint
   */
  @GET('/epics/:id/relationships/approvedBy')
  @websocket('epics', 'approvedBy', 'read')
  @authenticated
  async relationshipApprovedByView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Epic,
      relationship: 'approvedBy',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: UserView, view: DocumentViewType.relationship })
  }

  /**
   * Set the user who approved this epic
   * @endpoint
   */
  @PATCH('/epics/:id/relationships/approvedBy')
  @websocket('epics', 'approvedBy', 'patch')
  @authenticated
  async relationshipApprovedByPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Epic,
      change: 'patch',
      relationship: 'approvedBy',
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'nominees':
        return {
          many: true,

          hasPermission (connection, entity) {
            if (!entity.approvedById && entity.nominatedById === connection.state.user.id) {
              return Permission.granted({ permissions: ['epics.write.me'], connection })
            }
            return Permission.granted({ permissions: ['epics.write'], connection })
          },

          add ({ entity, ids }) {
            return entity.addNominees(ids)
          },

          patch ({ entity, ids }) {
            return entity.setNominees(ids)
          },

          remove ({ entity, ids }) {
            return entity.removeNominees(ids)
          },
        }

      case 'nominatedBy':
        return {
          many: false,

          hasPermission (connection) {
            return Permission.granted({ permissions: ['epics.write'], connection })
          },

          add ({ entity, id }) {
            return entity.setNominatedBy(id)
          },

          patch ({ entity, id }) {
            return entity.setNominatedBy(id)
          },
        }

      case 'approvedBy':
        return {
          many: false,

          hasPermission (connection) {
            return Permission.granted({ permissions: ['epics.write'], connection })
          },

          add ({ entity, id }) {
            return entity.setApprovedBy(id)
          },

          patch ({ entity, id }) {
            return entity.setApprovedBy(id)
          },
        }

      default:
        throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
    }
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
    return {
      nominees: 'users',
      rescue: 'rescues',
      nominatedBy: 'users',
      approvedBy: 'users',
    }
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      notes: WritePermission.group,
    }
  }
}
