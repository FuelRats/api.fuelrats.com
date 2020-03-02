import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
import {
  NotFoundAPIError,
  UnsupportedMediaAPIError,
} from '../classes/APIError'
import Announcer from '../classes/Announcer'
import Event from '../classes/Event'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Rescue, db } from '../db'
import DatabaseQuery from '../query/DatabaseQuery'

import { RescueView, RatView } from '../view'
import {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  PATCH,
  DELETE,
  parameters,
  WritePermission,
} from './API'
import APIResource from './APIResource'

const rescueAccessHours = 3
const rescueAccessTime = rescueAccessHours * 60 * 60 * 1000

const rescueCountQuery = `
SELECT COUNT("id") FROM "Rescues"
WHERE 
    "deletedAt" IS NULL AND
    "status" = 'closed' AND
    "outcome" = 'success'
`

/**
 * @classdesc Rescues API endpoint
 * @class
 */
export default class Rescues extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'rescues'
  }

  /**
   * Search rescues
   * @endpoint
   */
  @GET('/rescues')
  @websocket('rescues', 'search')
  @authenticated
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Rescue.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ query, result, type: RescueView })
  }

  /**
   * Get a rescue by id
   * @endpoint
   */
  @GET('/rescues/:id')
  @websocket('rescues', 'read')
  @authenticated
  async findById (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Rescue })

    return new DatabaseDocument({ query, result, type: RescueView })
  }

  /**
   * Create a rescue
   * @endpoint
   */
  @POST('/rescues')
  @websocket('rescues', 'create')
  @authenticated
  @permissions('rescues.write')
  async create (ctx) {
    const result = await super.create({
      ctx,
      databaseType: Rescue,
      allowId: true,
      overrideFields: {
        lastEditUserId: ctx.state.user.id,
        lastEditClientId: ctx.state.clientId,
      },
    })

    const query = new DatabaseQuery({ connection: ctx })
    Event.broadcast('fuelrats.rescuecreate', ctx.state.user, { id: result.id })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: RescueView })
  }

  /**
   * Update a rescue
   * @endpoint
   */
  @PUT('/rescues/:id')
  @websocket('rescues', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    const result = await super.update({
      ctx,
      databaseType: Rescue,
      updateSearch: { id: ctx.params.id },
      overrideFields: {
        lastEditUserId: ctx.state.user.id,
        lastEditClientId: ctx.state.clientId,
      },
    })

    if (ctx.data.data.attributes.outcome) {
      const caseId = result.commandIdentifier ?? result.id
      await Announcer.sendRescueMessage({
        message: `[Paperwork] Paperwork for case ${caseId} (${result.client}) 
      has been completed by ${ctx.state.user.preferredRat().name}`,
      })

      const [[{ count }]] = await db.query(rescueCountQuery)
      const rescueCount = Number(count)
      if (rescueCount % 1000 === 0) {
        await Announcer.sendRescueMessage({ message: `This was rescue #${rescueCount}!` })
      }
    }

    const query = new DatabaseQuery({ connection: ctx })
    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, { id: result.id })
    return new DatabaseDocument({ query, result, type: RescueView })
  }

  /**
   * Delete a rescue by id
   * @endpoint
   */
  @DELETE('/rescues/:id')
  @websocket('rescues', 'delete')
  @authenticated
  @permissions('rescues.write')
  async delete (ctx) {
    const rescue = await super.findById({ ctx, databaseType: Rescue, requirePermission: false })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    await Rescue.update({
      deletedAt: new Date(),
      lastModifiedById: ctx.state.user.id,
    }, { id: rescue.id })

    Event.broadcast('fuelrats.rescuedelete', ctx.state.user, {
      id: ctx.params.id,
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  // relationships

  /**
   * Get a rescue's assigned rats
   * @endpoint
   */
  @GET('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'read')
  @authenticated
  async relationshipRatsView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Rescue,
      relationship: 'rats',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView, view: DocumentViewType.relationship })
  }

  /**
   * Assign rats to a rescue
   * @endpoint
   */
  @POST('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'create')
  @authenticated
  async relationshipRatsCreate (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'add',
      relationship: 'rats',
    })

    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, {
      id: ctx.params.id,
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Set the assigned rats of a rescue
   * @endpoint
   */
  @PATCH('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'patch')
  @authenticated
  async relationshipRatsPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'patch',
      relationship: 'rats',
    })

    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, {
      id: ctx.params.id,
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Unassign rats from a rescue
   * @endpoint
   */
  @DELETE('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'delete')
  @authenticated
  async relationshipRatsDelete (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'remove',
      relationship: 'rats',
    })

    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, {
      id: ctx.params.id,
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a rescue's first limpet
   * @endpoint
   */
  @GET('/rescues/:id/relationships/firstLimpet')
  @websocket('rescues', 'firstLimpet', 'read')
  @authenticated
  async relationshipFirstLimpetView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Rescue,
      relationship: 'firstLimpet',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView, view: DocumentViewType.relationship })
  }

  /**
   * Set a rescue's first limpet
   * @endpoint
   */
  @PATCH('/rescues/:id/relationships/firstLimpet')
  @websocket('rescues', 'firstLimpet', 'patch')
  @authenticated
  async relationshipFirstLimpetPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'patch',
      relationship: 'firstLimpet',
    })

    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, {
      id: ctx.params.id,
    })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      client: WritePermission.group,
      clientNick: WritePermission.group,
      clientLanguage: WritePermission.group,
      commandIdentifier: WritePermission.sudo,
      codeRed: WritePermission.group,
      data: WritePermission.group,
      notes: WritePermission.group,
      platform: WritePermission.group,
      system: WritePermission.group,
      title: WritePermission.sudo,
      status: WritePermission.group,
      unidentifiedRats: WritePermission.group,
      outcome: WritePermission.group,
      quotes: WritePermission.group,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal,
    }
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    const { user } = ctx.state
    if (!user) {
      return false
    }

    if ((Date.now() - entity.createdAt) < rescueAccessTime) {
      return true
    }

    const isAssigned = entity.rats.some((rat) => {
      return rat.userId === user.id
    })

    let isFirstLimpet = false
    if (entity.firstLimpet) {
      isFirstLimpet = entity.firstLimpet.userId === user.id
    }

    if (isAssigned || isFirstLimpet) {
      return Permission.granted({ permissions: ['rescues.write'], connection: ctx })
    }
    return false
  }

  /**
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'rats':
        return {
          many: true,

          hasPermission (connection, entity) {
            return this.isSelf({ ctx: connection, entity }) || Permission.granted({
              permissions: ['rescues.write'],
              connection,
            })
          },

          async add ({ entity, ids, ctx, transaction }) {
            await entity.addRats(ids, {
              through: {
                assignerUserId: ctx.state.user.id,
                assignerClientId: ctx.state.clientId,
              },
              transaction,
            })

            entity.setChangelogDetails(ctx)
            return entity.save({ transaction })
          },

          async patch ({ entity, ids, ctx, transaction }) {
            await entity.setRats(ids, {
              through: { assignerUserId: ctx.state.user.id, assignerClientId: ctx.state.clientId },
              transaction,
            })

            entity.setChangelogDetails(ctx)
            return entity.save({ transaction })
          },

          async remove ({ entity, ids, ctx, transaction }) {
            await entity.removeRats(ids, { transaction })

            entity.setChangelogDetails(ctx)
            return entity.save({ transaction })
          },
        }

      case 'firstLimpet':
        return {
          many: false,

          hasPermission (connection, entity) {
            return this.isSelf({ ctx: connection, entity }) || Permission.granted({
              permissions: ['rescues.write'],
              connection,
            })
          },

          patch ({ entity, id, ctx, transaction }) {
            const rescue = entity
            rescue.firstLimpetId = id
            rescue.setChangelogDetails(ctx)
            return rescue.save({ transaction })
          },
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
      rats: 'rats',
      firstLimpet: 'rats',
    }
  }
}
