'use strict'

let Rescue = require('../models/rescue')
let mongoose = require('mongoose')
let winston = require('winston')

exports.get = function (request, response, next) {
  response.model.data = {}
  response.status(200)
  getOverallRescueCount()
  next()
}

let getOverallRescueCount = function () {
  Rescue.aggregate([
    // Grouping pipeline
    {
      '$group': {
        _id: {
          month: {
            $month: '$createdAt'
          },
          day: {
            $dayOfMonth: '$createdAt'
          },
          year: {
            $year: '$createdAt'
          }
        },
        count: {
          $sum: 1
        }
      }
    }
  ], function (error, result) {
    console.log(error)
    console.log(result)
  })
}
