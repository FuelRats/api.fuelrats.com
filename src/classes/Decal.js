

import { Rescue, User, Rat, Decal as Decals } from '../db'
import { BadRequestAPIError } from './APIError'

const originalDecalDeadline = '2016-04-01 00:00:00+00'
const rescueParticipationRequirement = 10

export default class Decal {
  static async checkEligible (user) {
    let decal = await Decals.findOne({
      where: {
        userId: user.id
      }
    })

    if (decal) {
      return decal
    }

    let previouslyEligible = await checkEligibleForOriginalDecal(user)
    if (previouslyEligible && previouslyEligible.rats) {
      for (let rat of previouslyEligible.rats) {
        if (rat.firstLimpet.length > 0) {
          throw new BadRequestAPIError({})
        }
      }
    }

    let eligible = await checkEligibleForRescueDecal(user)
    if (eligible && eligible.rats) {
      for (let rat of eligible.rats) {
        if (rat.firstLimpet.length >= rescueParticipationRequirement) {
          return { eligible: true }
        }
      }
    }
    throw new BadRequestAPIError({})
  }

  static async getDecalForUser (user) {
    let decalEligible = await Decal.checkEligible(user)
    if (decalEligible) {
      let decal = await Decal.redeem(user, 'Rescues')
      if (!decal) {
        throw 'Could not find decal'
      }
      return decal
    } else {
      return decalEligible
    }
  }

  static async redeem (user, type, notes = '') {
    let availableDecal = await Decals.findOne({
      where: {
        userId: null,
        claimedAt: null,
        type: 'Rescues'
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
 * Check wether a user was eligible for the origina 3301 decals issued by Frontier on April 1st as a present for
 * the Fuel Rats completing 10,000 rescues.
 * @param user The user to check eligibility for
 * @returns {*} A user if the user is eligible, null if not.
 */
function checkEligibleForOriginalDecal (user) {
  return User.findOne({
    where: {
      id: user.id
    },
    include: [{
      required: true,
      model: Rat,
      as: 'rats',
      include: [{
        required: true,
        where: {
          createdAt: {
            $lt: originalDecalDeadline
          },
          outcome: 'success'
        },
        model: Rescue,
        as: 'firstLimpet'
      }]
    }]
  })
}

/**
 * Check wether the user is eligible for a new rescue decal
 * @param user the user to check eligibility for
 * @returns {*} A user if the user is eligible, null if not.
 */
function checkEligibleForRescueDecal (user) {
  return User.findOne({
    where: {
      id: user.id
    },
    include: [{
      required: true,
      model: Rat,
      as: 'rats',
      include: [{
        required: true,
        where: {
          createdAt: {
            $lt: getLastMonthTurnover()
          },
          outcome: 'success'
        },
        model: Rescue,
        as: 'firstLimpet'
      }]
    }]
  })
}

/**
 * Get a date object for the last time decals were issued (1st of every month)
 * @returns {Date} A date object for midnight UTC on the 1st of the current month.
 */
function getLastMonthTurnover () {
  let foo = new Date()
  foo.setUTCDate(1)
  foo.setUTCHours(0)
  foo.setUTCMinutes(0)
  foo.setUTCSeconds(0)
  return foo
}
