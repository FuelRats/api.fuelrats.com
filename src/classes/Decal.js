

import { Rescue, User, Rat, Decal as Decals } from '../db'
import { BadRequestAPIError } from './APIError'

const originalDecalDeadline = '2016-04-01 00:00:00+00'
const minimumRescueCount = 10

// language=PostgreSQL
const queryOfDoom = `
WITH "EligibleRats" AS (
	SELECT
		COUNT(DISTINCT "Rescues"."id") AS "count",
		COUNT(DISTINCT "Decals"."id") AS "existingDecals"
	FROM "Users"
	INNER JOIN "Rats" ON "Rats"."userId" = "Users"."id"
	INNER JOIN "Rescues" ON "Rescues"."firstLimpetId" = "Rats"."id"
	LEFT JOIN "Decals" ON "Decals"."userId" = "Users"."id"
	WHERE
		NOT EXISTS (
			SELECT NULL FROM "Rescues" WHERE
				"Rescues"."firstLimpetId" = "Rats"."id" AND
				"Rescues"."deletedAt" IS NULL AND
				"Rescues"."outcome" = 'success' AND
				"Rescues"."createdAt" < :originalDecalDeadline
		) AND
		"Users"."id" = 'e9520722-02d2-4d69-9dba-c4e3ea727b14' AND
		"Decals"."type" = 'Rescues' AND
		"Rats"."deletedAt" IS NULL AND
		"Rescues"."deletedAt" IS NULL AND
		"Rescues"."outcome" = 'success' AND
		"Rescues"."createdAt" < :monthTurnOver
	GROUP BY "Rats"."id"
    HAVING COUNT(DISTINCT "Rescues"."id") >= :minimumRescueCount
)

SELECT COUNT("EligibleRats"."count") - min("existingDecals") AS "canRedeem"
FROM "EligibleRats"
`

export default class Decal {

  static async checkEligible2 ({user}) {
    let decal = await Decals.findOne({
      where: {
        userId: user.id
      }
    })

    if (decal) {
      return decal
    }

    let previouslyEligible = await checkEligibleForOriginalDecal({user})
    if (previouslyEligible && previouslyEligible.rats) {
      for (let rat of previouslyEligible.rats) {
        if (rat.firstLimpet.length > 0) {
          throw new BadRequestAPIError({})
        }
      }
    }

    let eligible = await checkEligibleForRescueDecal({user})
    if (eligible && eligible.rats) {
      for (let rat of eligible.rats) {
        if (rat.firstLimpet.length >= rescueParticipationRequirement) {
          return { eligible: true }
        }
      }
    }
    throw new BadRequestAPIError({})
  }

  static async getDecalFor ({user}) {
    let decalEligible = await Decal.checkEligible({user})
    if (decalEligible) {
      let decal = await Decal.redeem({user, type: 'Rescues'})
      if (!decal) {
        throw 'Could not find decal'
      }
      return decal
    } else {
      return decalEligible
    }
  }

  static async redeem ({user, type, notes = ''}) {
    let availableDecal = await Decals.findOne({
      where: {
        userId: null,
        claimedAt: null,
        type: type
      }
    })

    if (!availableDecal) {
      throw 'Could not find any available decals'
    }

    return availableDecal.update({
      userId: user.id,
      notes: notes,
      claimedAt: Date.now()
    })
  }
}


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
