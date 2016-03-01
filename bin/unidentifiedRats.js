'use strict'

let winston = require('winston')
let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')
let mongoose = require('mongoose')

mongoose.connect('mongodb://localhost/fuelrats')

winston.info('Starting unidentified rats fix')

Rescue.find({ unidentifiedRats: { '$exists': true, '$not': {'$size': 0}}  }).exec().then(function (rescues) {
  winston.info('Found ' + rescues.length + ' rescues with unidentified rats')
  rescues.forEach(function (rescue) {
    rescue.unidentifiedRats.forEach(function (unidentifiedRat) {
      Rat.findOne({ CMDRname: { $regex: new RegExp('^' + unidentifiedRat, 'i') } }).exec().then(function (rat) {
        if (!rat) {
          winston.info('Unable to find rat for ' + unidentifiedRat)
        } else {
          rescue.rats.push(rat)
          rescue.unidentifiedRats.splice(rescue.unidentifiedRats.indexOf(unidentifiedRat), 1)
          rescue.save(function (err) {
            if (err) {
              winston.error(err)
            } else {
              winston.info('Found rat ' + unidentifiedRat + ', adding to rescue')
            }
          })
        }
      }, function (error) {
        winston.error(error)
      })
    })
  })
}, function (error) {
  winston.error(error)
})
