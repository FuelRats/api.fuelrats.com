'use strict'

const db = require('../db').db
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const API = require('../classes/API')
const Result = require('../Results')
const RescueStatisticsQuery = require('../Query/RescueStatisticsQuery')
const SystemStatisticsQuery = require('../Query/SystemStatisticsQuery')

const Errors = require('../errors')

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