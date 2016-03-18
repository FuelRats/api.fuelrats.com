'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')
let winston = require('winston')

let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')

mongoose.connect('mongodb://localhost/fuelrats')

console.log('Loading rescues...')

Rescue.find({
  firstLimpet: {
    $exists: false
  },
  rats: {
    $exists: true
  }
})
.exec()
.then(function (rescues) {
  let saves = []

  console.log('Updating rescues...')

  rescues.forEach(function (rescue, index) {
    if (rescue.rats.length) {
      saves.push(Rescue.findByIdAndUpdate(rescue._id, {
        $set: {
          firstLimpet: rescue.rats.shift(),
          rats: rescue.rats
        }
      }))
    }
  })

  Promise.all(saves)
  .then(function (results) {
    console.log('Updated ' + results.length + ' rescues')
    mongoose.disconnect()
  })
  .catch(function (error) {
    console.error(error)
    mongoose.disconnect()
  })
})
