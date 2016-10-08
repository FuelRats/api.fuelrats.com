'use strict'

let db = require('../db').db
let Rat = require('../db').Rat
let Rescue = require('../db').Rescue
let Epic = require('../db').Epic
let API = require('../classes/API')
let Result = require('../Results')
let RescueStatisticsQuery = require('../Query/RescueStatisticsQuery')
let SystemStatisticsQuery = require('../Query/SystemStatisticsQuery')

let Errors = require('../errors')

class Statistics {
  static rescues (params, connection, data) {
    return new Promise(function (resolve, reject) {
      let stats = new RescueStatisticsQuery(params, connection).toSequelize
      console.log(stats)
      Rescue.findAll(stats).then(function (result) {
        resolve(new Result(result, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static systems (params, connection, data) {
    return new Promise(function (resolve, reject) {
      let stats = new SystemStatisticsQuery(params, connection).toSequelize
      console.log(stats)
      Rescue.findAll(stats).then(function (result) {
        resolve(new Result(result, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }
}

module.exports = Statistics