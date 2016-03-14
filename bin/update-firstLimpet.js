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
    console.log(rescue)
    if (rescue.rats.length) {
      rescue.firstLimpet = rescue.rats.shift()

      saves.push(rescue.save())
    }
  })

  Promise.all(saves)
  .then(function (results) {
    console.log('rescues', rescues.length)
    console.log('results', results.length)
    console.log('Done')
//    mongoose.disconnect()
  })
  .catch(function (error) {
    console.error(error)
    mongoose.disconnect()
  })
})
