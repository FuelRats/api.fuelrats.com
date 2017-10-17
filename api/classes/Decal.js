'use strict'

const { Rescue, User, Rat, Decal: Decals } = require('../db')
const Error = require('../errors')

const originalDecalDeadline = '2016-04-01 00:00:00+00'
const rescueParticipationRequirement = 10

class Decal {
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
          throw Error.template('bad_request', 'User qualifies for originally issued decal')
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
    throw Error.template('bad_request', 'User does not qualify for any decal')
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

function getLastMonthTurnover () {
  let foo = new Date()
  foo.setUTCDate(1)
  foo.setUTCHours(0)
  foo.setUTCMinutes(0)
  foo.setUTCSeconds(0)
  return foo
}
module.exports = Decal