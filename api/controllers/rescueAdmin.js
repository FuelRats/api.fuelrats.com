'use strict'

let _ = require('underscore')
let winston = require('winston')
let Permission = require('../permission')
let Rescue = require('../db').Rescue
let Rat = require('../db').Rat
let Epic = require('../db').Epic
let findRescueWithRats = require('./rescue').findRescueWithRats
let getRescuePermissionType = require('./rescue').getRescuePermissionType
let convertRescueToAPIResult = require('./rescue').convertRescueToAPIResult

// EDIT
// =============================================================================
exports.editRescue = function (request, response) {
  findRescueWithRats({ id: request.params.id }).then(function (rescueInstance) {
    if (!rescueInstance) {
      return response.render('errors/404.swig', { path: request.path })
    }

    let rescue = convertRescueToAPIResult(rescueInstance)

    // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
    let permission = getRescuePermissionType(rescue, request.user)

    Permission.require(permission, request.user).then(function () {
      response.render('rescue-edit.swig', { rescue: rescue, southern: request.isSouthernHemisphere })
    }, function () {
      response.render('errors/403.swig', { message: 'Only assigned rats or administrators may edit rescues' })
    })
  }).catch(function () {
    return response.render('errors/404.swig', { path: request.path })
  })


}

// VIEW
// =============================================================================
exports.viewRescue = function (request, response, next) {
  Rescue.findOne({
    where: { id: request.params.id },
    include: [
      {
        model: Rat,
        as: 'rats',
        required: false
      },
      {
        model: Rat,
        as: 'firstLimpet',
        required: false
      },
      {
        model: Epic,
        as: 'epics',
        include: [{
          model: Rat,
          as: 'rat',
          required: false
        }],
        required: false
      }
    ]
  }).then(function (rescueInstance) {
    try {
      if (!rescueInstance) {
        return response.render('errors/404.swig', { path: request.path })
      }

      let rescue = rescueInstance.toJSON()

      if (rescue.epics.length > 0) {
        let epicRatList = rescue.epics.map(function (epic) {
          return epic.rat.CMDRname
        })

        rescue.epicString = `${formatArray(epicRatList)} has received an epic commendation for this rescue`
      }

      rescue = Object.assign(rescue, {
        southern: request.isSouthernHemisphere
      })

      response.render('rescue-view.swig', rescue)
    } catch (err) {
      console.log(err)
    }
  }).catch(function () {
    return response.render('errors/404.swig', { path: request.path })
  })
}

function formatArray (arr) {
  let outStr = ''
  if (arr.length === 1) {
    outStr = arr[0]
  } else if (arr.length === 2) {
    outStr = arr.join(' and ')
  } else if (arr.length > 2) {
    outStr = arr.slice(0, -1).join(', ') + ', and ' + arr.slice(-1)
  }
  return outStr
}
