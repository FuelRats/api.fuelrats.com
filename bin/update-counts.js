'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')
let winston = require('winston')

let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')

mongoose.connect('mongodb://localhost/fuelrats')

console.log('Zeroing out rat rescue counts...')

Rat.update({}, {
  $set: {
    failedAssistCount: 0,
    failedRescueCount: 0,
    successfulAssistCount: 0,
    successfulRescueCount: 0
  }
})
.then(function () {
  console.log(  'Loading rescues...')

  Rescue.find()
  .exec()
  .then(function (rescues) {
    let saves = []

    console.log('Updating rat rescue counts...')

    rescues.forEach(function (rescue, index) {
      console.log('Updating ' + rescue._id)

      let updates = {}

      if (rescue.firstLimpet) {
        if (rescue.successful) {
          updates[rescue.firstLimpet] = {
            $inc: {
              successfulRescueCount: 1
            }
          }
        } else {
          updates[rescue.firstLimpet] = {
            $inc: {
              failedRescueCount: 1
            }
          }
        }
      }

      if (rescue.rats.length) {
        rescue.rats.forEach(function (rat, index) {
          let update = {
            $inc: {}
          }

          if (rescue.successful) {
            updates[rescue.firstLimpet] = {
              $inc: {
                successfulAssistCount: 1
              }
            }
          } else {
            updates[rescue.firstLimpet] = {
              $inc: {
                failedAssistCount: 1
              }
            }
          }
        })
      }

      Object.keys(updates).forEach(function (id, index) {
        saves.push(Rat.findByIdAndUpdate(id, updates[id]))
      })
    })

    Promise.all(saves)
    .then(function () {
      console.log('Done')
      mongoose.disconnect()
    })
    .catch(function (error) {
      console.error(error)
      mongoose.disconnect()
    })
  })
  .catch(console.error)
})
.catch(console.error)
