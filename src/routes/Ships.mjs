import { UnsupportedMediaAPIError } from '../classes/APIError'
import Permission from '../classes/Permission'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Ship, db } from '../db'
import { DocumentViewType } from '../Documents'
import DatabaseDocument from '../Documents/DatabaseDocument'
import DatabaseQuery from '../query/DatabaseQuery'
import { ShipView, RatView } from '../view'
import {
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


const availableShipIdQuery = `
SELECT "rowNumber" "shipId"                                                   
FROM (SELECT "shipId", ROW_NUMBER() OVER (ORDER BY "shipId") "rowNumber" FROM "Ships") ships
WHERE "rowNumber" != "shipId"                                                                 
ORDER BY "rowNumber" OFFSET 0 ROW FETCH NEXT 1 ROW ONLY;
`

const nextShipIdQuery = `
SELECT "shipId" + 1 as "nextId"
FROM "Ships"
ORDER BY "shipId" DESC
LIMIT 1
`

/**
 * Class managing Ship related endpoints
 */
export default class Ships extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'ships'
  }

  /**
   * Search ships
   * @endpoint
   */
  @GET('/ships')
  @websocket('ships', 'search')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const result = await Ship.findAndCountAll(query.searchObject)
    return new DatabaseDocument({ result, query, type: ShipView })
  }

  /**
   * Get a ship by id
   * @endpoint
   */
  @GET('/ships/:id')
  @websocket('ships', 'read')
  @parameters('id')
  async findById (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Ship })

    return new DatabaseDocument({ query, result, type: ShipView })
  }

  /**
   * Create a ship
   * @endpoint
   */
  @POST('/ships')
  @websocket('ships', 'create')
  @authenticated
  async create (ctx) {
    this.requireRelationships({ ctx, relationships: ['rat'] })

    let [[shipId]] = await db.query(availableShipIdQuery)
    if (!shipId) {
      [[{ nextId: shipId }]] = await db.query(nextShipIdQuery)
    }

    const result = await super.create({
      ctx,
      databaseType: Ship,
      overrideFields: { shipId },
    })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: ShipView })
  }

  /**
   * Update a ship
   * @endpoint
   */
  @PUT('/ships')
  @websocket('ships', 'update')
  @authenticated
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Ship, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: ShipView })
  }

  /**
   * Delete a ship
   * @endpoint
   */
  @DELETE('/ships/:id')
  @websocket('ships', 'delete')
  @parameters('id')
  @authenticated
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Ship })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * View a ship's rat relationship
   * @endpoint
   */
  @GET('/ships/:id/relationships/rat')
  @websocket('ships', 'rat', 'read')
  @parameters('id')
  @authenticated
  async relationshipRatView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Ship,
      relationship: 'rat',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: RatView, view: DocumentViewType.relationship })
  }

  /**
   * Set a ship's rat relationship
   * @endpoint
   */
  @PATCH('/ships/:id/relationships/rat')
  @websocket('ships', 'rat', 'patch')
  @parameters('id')
  @authenticated
  async relationshipRatPatch (ctx) {
    await this.relationshipChange({
      ctx,
      databaseType: Ship,
      change: 'patch',
      relationship: 'rat',
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
      shipType: WritePermission.group,
      shipId: WritePermission.internal,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal,
    }
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    const hasRat = ctx.state.user.rats.find((rat) => {
      return rat.id === entity.ratId
    })
    if (hasRat) {
      return Permission.granted({ permissions: ['ships.write.me'], connection: ctx })
    }
    return false
  }

  /**
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    if (relationship === 'rat') {
      return {
        many: false,

        hasPermission (connection, entity, id) {
          const hasEntityRat = connection.state.user.rats.some((rat) => {
            return rat.id === entity.ratId
          })

          const hasNewRat = connection.state.user.rats.some((rat) => {
            return rat.id === id
          })
          return (hasEntityRat && hasNewRat) || Permission.granted({ permissions: ['rats.write'], connection })
        },

        add ({ entity, id, transaction }) {
          return entity.setRat(id, { transaction })
        },

        patch ({ entity, id, transaction }) {
          return entity.setRat(id, { transaction })
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
      rat: 'rats',
    }
  }
}
