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
    rescueCount: 0,
    failedAssistCount: 0,
    failedRescueCount: 0,
    successfulAssistCount: 0,
    successfulRescueCount: 0
  }
}, {
  multi: true
})
.then(function () {
  console.log('Loading rescues...')

  Rescue.find()
  .exec()
  .then(function (rescues) {
    let saves = []

    console.log('Updating rat rescue counts...')

    rescues.forEach(function (rescue, index) {
      let updates = []

      if (rescue.firstLimpet) {
        if (rescue.successful) {
          updates.push({
            id: rescue.firstLimpet,
            update: {
              $inc: {
                successfulRescueCount: 1
              }
            }
          })
        } else {
          updates.push({
            id: rescue.firstLimpet,
            update: {
              $inc: {
                failedRescueCount: 1
              }
            }
          })
        }
      }

      if (rescue.rats.length) {
        rescue.rats.forEach(function (rat, index) {
          let update = {
            $inc: {}
          }

          if (rescue.successful) {
            updates.push({
              id: rat,
              update: {
                $inc: {
                  successfulAssistCount: 1
                }
              }
            })
          } else {
            updates.push({
              id: rat,
              update: {
                $inc: {
                  failedAssistCount: 1
                }
              }
            })
          }
        })
      }

      updates.forEach(function (update) {
        saves.push(Rat.findByIdAndUpdate(update.id, update.update))
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
