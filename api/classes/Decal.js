'use strict'

let Rescue = require('../db').Rescue
let User = require('../db').User
let Rat = require('../db').Rat
let Decals = require('../db').Decal
let Error = require('../errors')

const originalDecalDeadline = '2016-04-01 00:00:00+00'
const rescueParticipationRequirement = 10

class Decal {
  static checkEligble (user) {
    return new Promise(function (resolve, reject) {
      Decals.findOne({
        where: {
          userId: user.id
        }
      }).then(function (decal) {
        if (decal) {
          return resolve(decal)
        }

        checkEligibleForOriginalDecal(user).then(function (previouslyEligible) {
          if (previouslyEligible && previouslyEligible.rats) {
            for (let rat of previouslyEligible.rats) {
              if (rat.firstLimpet.length > 0) {
                return reject(Error.throw('bad_request', 'User qualifies for originally issued decal'))
              }
            }
          }

          checkEligibleForRescueDecal(user).then(function (eligible) {
            if (eligible && eligible.rats) {
              for (let rat of eligible.rats) {
                if (rat.firstLimpet.length >= rescueParticipationRequirement) {
                  return resolve(true)
                }
              }
            }
            reject(Error.throw('bad_request', 'User does not qualify for any decal'))
          })
        })
      }).catch(function (error) {
        reject (Error.throw('server_error', error))
      })
    })
  }

  static getDecalForUser (user) {
    return new Promise(function (resolve, reject) {
      Decal.checkEligble(user).then(function (decal) {
        if (decal === true) {
          Decal.redeem(user, 'Rescues').then(function (decal) {
            if (!decal) {
              return reject('Could not find decal')
            }
            resolve(decal)
          })
        } else {
          resolve(decal)
        }
      }).catch(function (error) {
        reject(error)
      })
    })
  }

  static redeem (user, type, notes = '') {
    return new Promise(function (resolve, reject) {
      Decals.findOne({
        where: {
          userId: null,
          type: 'Rescues'
        }
      }).then(function (availableDecal) {
        if (!availableDecal) {
          reject('Could not find any available decals')
        }

        availableDecal.update({
          userId: user.id,
          notes: notes,
          claimedAt: Date.now()
        }).then(function (decal) {
          resolve(decal)
        })
      }).catch(function (error) {
        reject(error)
      })
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
          successful: true
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
            $lt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
          },
          successful: true
        },
        model: Rescue,
        as: 'firstLimpet'
      }]
    }]
  })
}

module.exports = Decal