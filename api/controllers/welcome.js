'use strict'

var _, moment, winston

_ = require('underscore')
moment = require('moment')
winston = require('winston')


exports.get = function (request, response) {
  if (request.isUnauthenticated()) {
    response.redirect('/login')

  } else {
    request.user.populate('CMDRs', function (error) {
      var rescueFinds

      rescueFinds = []

      if (error) {
        return winston.error(error)
      }

      request.user.CMDRs.forEach(function (CMDR) {
        rescueFinds.push(new Promise(function (resolve, reject) {
          CMDR.populate('rescues', function (error, rescues) {
            if (error) {
              return reject(error)
            }

            CMDR.rescues.forEach(function (rescue) {
              rescue.createdAt = moment(rescue.createdAt)
              rescue.lastModified = moment(rescue.lastModified)

              let firstLimpet
              if (rescue.firstLimpet && rescue.firstLimpet[0]) {
                firstLimpet = rescue.firstLimpet[0]
              } else {
                firstLimpet = rescue.firstLimpet
              }

              if (CMDR._id.equals(firstLimpet) === false) {
                rescue.assist = true
              }
            })

            CMDR.rescues = _.sortBy(CMDR.rescues, 'createdAt').reverse()

            resolve(rescues)
          })
        }))
      })

      Promise.all(rescueFinds)
        .then(function () {
          request.user.rescues = []

          request.user.CMDRs.forEach(function (CMDR) {
            _.union(request.user, CMDR.rescues)
          })

          response.render('welcome.swig', request.user)
        })
        .catch(function (error) {
          winston.error(error)
        })
    })
  }
}
