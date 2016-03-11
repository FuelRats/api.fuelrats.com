'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')
let winston = require('winston')

let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')

mongoose.connect('mongodb://localhost/fuelrats')

let rescueFind = Rescue.find()

console.log('Loading rescues...')

rescueFind.populate('rescues')
.exec()
.then(function (rescues) {
  let saves = []

  console.log('Updating rescues...')

  rescues.forEach(function (rescue, index) {
    let hasFirstLimpet = !!rescue.firstLimpet

    if (rescue.rats.length && !hasFirstLimpet) {
      console.log('before', rescue)
      rescue.firstLimpet = rescue.rats.shift()
      console.log('after', rescue)
      console.log('')
      saves.push(rescue.save())
    }
  })

  Promise.all(saves)
  .then(function () {
    console.log('Done.')
    mongoose.disconnect()
  })
  .catch(function (error) {
    console.error(error)
    mongoose.disconnect()
  })
})
