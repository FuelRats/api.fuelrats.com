import { DocumentViewType } from '../Documents'
import DatabaseDocument from '../Documents/DatabaseDocument'
import { UnsupportedMediaAPIError } from '../classes/APIError'
import StatusCode from '../classes/StatusCode'
import { websocket } from '../classes/WebSocket'
import { Decal, db, User } from '../db'
import DatabaseQuery from '../query/DatabaseQuery'
import { DecalView } from '../view'
import {
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  PATCH,
  permissions,
  parameters,
  WritePermission,
} from './API'
import APIResource from './APIResource'

const originalDecalDeadline = '2016-04-01 00:00:00+00'
const minimumRescueCount = 10

/*
* This query retrieves the number of decals the user is eligible to redeem.
* A user is granted 1 decal per rat (CMDR) that had 10 rescues or more before the start of the current month.
* This excludes rats that had a rescue before April 2016 as those were already granted a decal using a previous giveaway
* The number of rescue decals already redeemed by the user is subtracted from the count.
* */

// language=PostgreSQL
const decalEligibilityQuery = `
WITH "EligibleRats" AS (
	SELECT
		COUNT(DISTINCT "Rescues"."id") AS "count",
		COUNT(DISTINCT "Decals"."id") AS "existingDecals"
	FROM "Users"
	LEFT JOIN "Rats" ON "Rats"."userId" = "Users"."id" AND "Rats"."deletedAt" IS NULL
	LEFT JOIN "Rescues" ON "Rescues"."firstLimpetId" = "Rats"."id" AND "Rescues"."deletedAt" IS NULL
	LEFT JOIN "Decals" ON "Decals"."userId" = "Users"."id" AND "Decals"."type" = 'Rescues'
	WHERE
		NOT EXISTS (
			SELECT NULL FROM "Rescues" WHERE
				"Rescues"."firstLimpetId" = "Rats"."id" AND
				"Rescues"."deletedAt" IS NULL AND
				"Rescues"."outcome" = 'success' AND
				"Rescues"."createdAt" < $originalDecalDeadline
		) AND
		"Users"."id" = $userId AND
		"Rescues"."outcome" = 'success' AND
		"Rescues"."createdAt" < $monthTurnOver
	GROUP BY "Rats"."id"
    HAVING COUNT(DISTINCT "Rescues"."id") >= $minimumRescueCount
)

SELECT COUNT("EligibleRats"."count") - min("existingDecals") AS "canRedeem"
FROM "EligibleRats"
`

/**
 *
 */
export default class Decals extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'decals'
  }

  /**
   * Search decals
   * @endpoint
   */
  @GET('/decals')
  @websocket('decals', 'search')
  @authenticated
  @permissions('decals.read')
  async search (ctx) {
    const query = new DatabaseQuery({ connection: ctx })
    const results = await Decal.findAndCountAll(query.searchObject)

    return new DatabaseDocument({ query, results, type: DecalView })
  }

  /**
   * Get a decal by ID
   * @endpoint
   */
  @GET('/decals/:id')
  @websocket('decals', 'read')
  @authenticated
  @parameters('id')
  async findById (ctx) {
    const { query, result } = await super.findById({ ctx, databaseType: Decal, requirePermission: true })
    return new DatabaseDocument({ query, result, type: DecalView })
  }

  /**
   * Create a decal
   * @endpoint
   */
  @POST('/decals')
  @websocket('decals', 'create')
  @authenticated
  @permissions('decals.write')
  async create (ctx) {
    const result = await super.create({ ctx, databaseType: Decal })

    const query = new DatabaseQuery({ connection: ctx })
    ctx.response.status = StatusCode.created
    return new DatabaseDocument({ query, result, type: DecalView })
  }

  /**
   * Update a decal by ID
   * @endpoint
   */
  @PUT('/decals/:id')
  @websocket('decals', 'update')
  @parameters('id')
  @authenticated
  async update (ctx) {
    const result = await super.update({ ctx, databaseType: Decal, updateSearch: { id: ctx.params.id } })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: DecalView })
  }

  /**
   * Delete a decal by ID
   * @endpoint
   */
  @DELETE('/decals/:id')
  @websocket('decals', 'delete')
  @parameters('id')
  @authenticated
  async delete (ctx) {
    await super.delete({ ctx, databaseType: Decal })

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Get a decal's rat relationship
   * @endpoint
   */
  @GET('/decals/:id/relationships/rat')
  @websocket('decals', 'rat', 'view')
  @parameters('id')
  @authenticated
  async relationshipRatView (ctx) {
    const result = await this.relationshipView({
      ctx,
      databaseType: Decal,
      relationship: 'rat',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: DecalView, view: DocumentViewType.meta })
  }

  /**
   * Set a decal's rat relationship
   * @endpoint
   */
  @PATCH('/decals/:id/relationships/rat')
  @websocket('decals', 'rat', 'patch')
  @parameters('id')
  @authenticated
  async relationshipRatPatch (ctx) {
    const result = await this.relationshipChange({
      ctx,
      databaseType: Decal,
      change: 'patch',
      relationship: 'rat',
    })

    const query = new DatabaseQuery({ connection: ctx })
    return new DatabaseDocument({ query, result, type: DecalView, view: DocumentViewType.meta })
  }

  /**
   * Get a date object for the exact start of the current month
   * @returns {Date} date object for the start of the current month
   */
  static getLastMonthTurnOver () {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCHours(0)
    date.setUTCMinutes(0)
    date.setUTCSeconds(0)
    return date
  }

  /**
   * Get a user's eligible decal count
   * @param {object} arg function arguments object
   * @param {User} arg.user the user to check
   * @returns {Promise<number>} the number of decals the user is eligible to redeem
   */
  static async getEligibleDecalCount ({ user }) {
    const { id: userId } = user
    const monthTurnOver = Decals.getLastMonthTurnOver()

    const [result] = await db.query(decalEligibilityQuery, {
      bind: { userId, originalDecalDeadline, monthTurnOver, minimumRescueCount },
      type: db.QueryTypes.SELECT,
    })

    const { canRedeem } = result ?? {}
    return canRedeem || 0
  }

  /**
   *
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    if (relationship === 'user') {
      return {
        many: false,

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

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    return entity.userId === ctx.state.user.id
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {
      code: WritePermission.sudo,
      type: WritePermission.sudo,
      notes: WritePermission.sudo,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal,
    }
  }
}
