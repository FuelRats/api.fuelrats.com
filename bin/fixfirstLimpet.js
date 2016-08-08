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

Rescue.find({ rats: { '$size': 0 } }).exec().then(function (rescues) {
  winston.info('Found ' + rescues.length + ' rescues with no rats')
  rescues.forEach(function (rescue) {
    if (rescue.firstLimpet) {
      let firstLimpet;
      if (rescue.firstLimpet[0]) {
        firstLimpet = rescue.firstLimpet[0]
      } else {
        firstLimpet = rescue.firstLimpet
      }

      Rat.findById(rescue.firstLimpet[0]).exec().then(function (rat) {
        if (!rat) {
          winston.info('Rat reference ' + firstLimpet + ' does not exist')
        } else {
          rescue.rats.push(rat)
          rescue.save(function (err) {
            if (err) {
              winston.error(err)
            } else {
              winston.info('Set rat ' + firstLimpet + ', as rat')
            }
          })
        }
      })
    } else {
      winston.info('Rescue ' + rescue.id + ' has no firstLimpet')
    }
  })
}, function (error) {
  winston.error(error)
})
