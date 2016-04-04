'use strict'

let winston = require('winston')
let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')
let mongoose = require('mongoose')

mongoose.connect('mongodb://localhost/fuelrats')

winston.info('Starting firstLimpet fix')

Rescue.find({ firstLimpet: { '$exists': false }, successful: true}).exec().then(function (rescues) {
  winston.info('Found ' + rescues.length + ' rescues with no firstLimpet')
  rescues.forEach(function (rescue) {
    if (rescue.rats.length > 0) {
      Rat.findById(rescue.rats[0]).exec().then(function (rat) {
        if (!rat) {
          winston.info('Rat reference ' + rescue.rats[0] + ' does not exist')
        } else {
          rescue.firstLimpet = rat
          rescue.save(function (err) {
            if (err) {
              winston.error(err)
            } else {
              winston.info('Set rat ' + rescue.rats[0] + ', as firstLimpet')
            }
          })
        }
      })
    } else {
      winston.info('Rescue ' + rescue.id + ' has no rats')
    }
  })
}, function (error) {
  winston.error(error)
})
