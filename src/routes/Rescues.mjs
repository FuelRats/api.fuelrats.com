import Announcer from '../classes/Announcer'
import {
  NotFoundAPIError, UnprocessableEntityAPIError,
} from '../classes/APIError'
import Event from '../classes/Event'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import {
  Rescue, db, WebPushSubscription, Rat, User,
} from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { DocumentViewType } from '../Documents/Document'
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
import { webPushPool } from './WebPushSubscriptions'

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
   * Get all rescues assigned to the current user
   * @endpoint
   */
  @GET('/rescues/me')
  async ownRescues (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const { searchObject } = query
    searchObject.include = [
      {
        model: Rat,
        as: 'rats',
        where: {
          userId: ctx.state.user.id,
        },
        required: true,
        duplicating: false,
        include: [
          {
            model: User,
            as: 'user',
          },
        ],
        through: {
          attributes: [],
        },
      },
      {
        model: Rat,
        as: 'firstLimpet',
        required: false,
      },
    ]
    const result = await Rescue.findAndCountAll(searchObject)
    return new DatabaseDocument({ query, result, type: RescueView })
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
  @parameters('id')
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
    const document = new DatabaseDocument({ query, result, type: RescueView })

    Event.broadcast('fuelrats.rescuecreate', ctx.state.user, result.id, document)
    ctx.response.status = StatusCode.created
    return document
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

    const { outcome } = ctx.data.data.attributes
    if (outcome && outcome !== 'purge') {
      const caseId = result.commandIdentifier ?? result.id
      await Announcer.sendRescueMessage({
        message: `[Paperwork] Paperwork for case ${caseId} (${result.client}) has been completed by ${ctx.state.user.displayName()}`,
      })

      const [[{ count }]] = await db.query(rescueCountQuery)
      const rescueCount = Number(count)
      if (rescueCount % 1000 === 0) {
        await Announcer.sendRescueMessage({ message: `This was rescue #${rescueCount}!` })
      }
    }

    const query = new DatabaseQuery({ connection: ctx })
    const document = new DatabaseDocument({ query, result, type: RescueView })
    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, result.id, document)
    return document
  }

  /**
   * Delete a rescue by id
   * @endpoint
   */
  @DELETE('/rescues/:id')
  @websocket('rescues', 'delete')
  @parameters('id')
  @authenticated
  @permissions('rescues.write')
  async delete (ctx) {
    const rescue = await super.findById({ ctx, databaseType: Rescue, requirePermission: false })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    if (ctx.state.forceDelete) {
      await Rescue.destroy({
        force: true,
      })
    } else {
      await Rescue.update({
        deletedAt: new Date(),
        lastModifiedById: ctx.state.user.id,
      }, { where: { id: rescue.result.id } })
    }


    Event.broadcast('fuelrats.rescuedelete', ctx.state.user, ctx.params.id)

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
  @parameters('id')
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
  @parameters('id')
  @authenticated
  async relationshipRatsCreate (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'add',
      relationship: 'rats',
    })
    const query = new DatabaseQuery({ connection: ctx })
    const document = new DatabaseDocument({ query, result, type: RescueView })
    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, ctx.params.id, document)

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Set the assigned rats of a rescue
   * @endpoint
   */
  @PATCH('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'patch')
  @parameters('id')
  @authenticated
  async relationshipRatsPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'patch',
      relationship: 'rats',
    })

    const query = new DatabaseQuery({ connection: ctx })
    const document = new DatabaseDocument({ query, result, type: RescueView })
    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, ctx.params.id, document)

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Unassign rats from a rescue
   * @endpoint
   */
  @DELETE('/rescues/:id/relationships/rats')
  @websocket('rescues', 'rats', 'delete')
  @parameters('id')
  @authenticated
  async relationshipRatsDelete (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'remove',
      relationship: 'rats',
    })

    const query = new DatabaseQuery({ connection: ctx })
    const document = new DatabaseDocument({ query, result, type: RescueView })
    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, ctx.params.id, document)

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a rescue's first limpet
   * @endpoint
   */
  @GET('/rescues/:id/relationships/firstLimpet')
  @websocket('rescues', 'firstLimpet', 'read')
  @parameters('id')
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
  @parameters('id')
  @authenticated
  async relationshipFirstLimpetPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Rescue,
      change: 'patch',
      relationship: 'firstLimpet',
      callback: (rescue) => {
        const hasRat = rescue.rats.some((rat) => {
          return rat.id === ctx.data.data.id
        })
        if (!hasRat) {
          throw new UnprocessableEntityAPIError({
            pointer: '/data/id',
          })
        }
      },
    })

    const query = new DatabaseQuery({ connection: ctx })
    const document = new DatabaseDocument({ query, result, type: RescueView })
    Event.broadcast('fuelrats.rescueupdate', ctx.state.user, ctx.params.id, document)

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * @endpoint
   */
  @POST('/rescues/:id/alert')
  @authenticated
  @parameters('id')
  @permissions('rescues.write')
  async postRescueAlert (ctx) {
    const rescue = await Rescue.findOne({ where: { id: ctx.params.id } })
    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    const query = {}
    if (rescue.platform === 'pc') {
      query.pc = true
    }
    if (rescue.platform === 'xb') {
      query.xb = true
    }
    if (rescue.platform === 'ps') {
      query.ps = true
    }
    if (rescue.expansion === 'odyssey') {
      query.odyssey = true
    }

    const subscriptions = WebPushSubscription.findAll({
      where: query,
    })
    webPushPool.exec('webPushBroadcast', [subscriptions, rescue])
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
      expansion: WritePermission.group,
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

    const isAssigned = entity.rats.some((rat) => {
      return rat.userId === user.id
    })

    let isFirstLimpet = false
    if (entity.firstLimpet) {
      isFirstLimpet = entity.firstLimpet.userId === user.id
    }

    if (isAssigned || isFirstLimpet || entity.status !== 'closed') {
      return Permission.granted({ permissions: ['rescues.write.me'], connection: ctx })
    }


    if (entity.status === 'closed' && (Date.now() - entity.createdAt) < rescueAccessTime) {
      return Permission.granted({ permissions: ['dispatch.write'], connection: ctx })
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
        return undefined
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
