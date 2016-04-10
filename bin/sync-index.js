'use strict'

let winston = require('winston')
let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')
let User = require('../api/models/user')
let mongoose = require('mongoose')

let count = 0
let streamsClosed = 0

mongoose.connect('mongodb://localhost/fuelrats')

winston.info('Beginning Index Model Sync')

winston.info('Syncing Rats')
let ratStream = Rat.synchronize()
ratStream.on('data', function (error, doc) {
  count++
})
ratStream.on('error', function (error) {
  console.error(error)
})
ratStream.on('close', function () {
  console.log('Finished syncing Rats')

  streamsClosed++

  if (streamsClosed === 2) {
    mongoose.disconnect()
  }
})

winston.info('Syncing Rescue')
Rescue.synchronize()
let rescueStream = Rescue.synchronize()
rescueStream.on('data', function (error, doc) {
  count++
})
rescueStream.on('error', function (error) {
  console.error(error)
})
rescueStream.on('close', function () {
  console.log('Finished syncing Rescues')

  streamsClosed++

  if (streamsClosed === 2) {
    mongoose.disconnect()
  }
})
