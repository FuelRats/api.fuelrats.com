

import { User, db } from '../db'
import API, {
  APIResource,
  authenticated,
  GET,
  permissions
} from '../classes/API'
import { NotFoundAPIError, UnsupportedMediaAPIError } from '../classes/APIError'
import { websocket } from '../classes/WebSocket'

const originalDecalDeadline = '2016-04-01 00:00:00+00'
const minimumRescueCount = 10

/*
* This query retrieves the number of decals the user is eligible to redeem.
* A user is granted 1 decal per rat (CMDR) that had 10 rescues or more before the start of the current month.
* This excludes rats that had a rescue before April 2016 as those were already granted a decal using a previous giveway
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
 * Get a date object for the last time decals were issued (1st of every month)
 * @returns {Date} A date object for midnight UTC on the 1st of the current month.
 */
function getLastMonthTurnover () {
  const foo = new Date()
  foo.setUTCDate(1)
  foo.setUTCHours(0)
  foo.setUTCMinutes(0)
  foo.setUTCSeconds(0)
  return foo
}

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

  async search (ctx) {

  }

  async findById () {

  }

  async create () {

  }

  async update () {

  }

  async delete () {

  }

  async redeem () {

  }

  static getLastMonthTurnOver () {
    const date = new Date()
    date.setUTCDate(1)
    date.setUTCHours(0)
    date.setUTCMinutes(0)
    date.setUTCSeconds(0)
    return date
  }

  static async getEligibleDecalCount ({ user }) {
    const { id: userId } = user
    const monthTurnOver = Decals.getLastMonthTurnOver()

    const [result] = await db.query(decalEligibilityQuery, {
      bind: { userId, originalDecalDeadline, monthTurnOver, minimumRescueCount  },
      type: db.QueryTypes.SELECT
    })

    const { canRedeem } = result || {}
    return canRedeem || 0
  }

  /**
   *
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'displayRat':
        return {
          many: false,

          add ({ entity, id }) {
            return entity.addUser(id)
          },

          patch ({ entity, id }) {
            return entity.setUser(id)
          },

          remove ({ entity, id }) {
            return entity.removeUser(id)
          }
        }

      default:
        throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
    }
  }

  get relationTypes () {
    return {
      'user': 'users'
    }
  }


  isGroup ({ ctx, entity }) {
    return false
  }

  isInternal ({ ctx, entity }) {
    return false
  }

  isSelf ({ ctx, entity }) {
    return false
  }

  get writePermissionsForFieldAccess () {
    return undefined
  }
}
export class Decals2 extends API {
  @GET('/decals/check')
  @websocket('decals', 'check')
  @authenticated
  @permissions('user.read.me')
  async check (ctx) {
    if (Object.keys(ctx.query).length > 0) {
      let user = await User.findOne({
        where: ctx.query
      })

      if (!user) {
        throw new NotFoundAPIError({ parameter: 'id' })
      }

      this.requireReadPermission(ctx, user)

      let eligible = await Decal.checkEligible(user)
      if (eligible.id) {
        return Decals.presenter.render(eligible)
      }
      return eligible
    } else {
      let eligible = await Decal.checkEligible(ctx.state.user)
      if (eligible.id) {
        return Decals.presenter.render(eligible)
      }
      return eligible
    }
  }

  @GET('/decals/redeem')
  @websocket('decals', 'redeem')
  @authenticated
  @permissions('user.write.me')
  async redeem (ctx) {
    let decal = await Decal.getDecalFor(ctx.state.user)
    return Decals.presenter.render(decal)
  }

  static get presenter () {
    class DecalsPresenter extends API.presenter {}
    DecalsPresenter.prototype.type = 'decals'
    return DecalsPresenter
  }
}
