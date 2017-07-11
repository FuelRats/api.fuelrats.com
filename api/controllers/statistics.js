'use strict'

const db = require('../db').db
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const API = require('../classes/API')
const RescueStatisticsQuery = require('../Query/RescueStatisticsQuery')
const SystemStatisticsQuery = require('../Query/SystemStatisticsQuery')
const RescueStatisticsPresenter = require('../classes/Presenters').RescueStatisticsPresenter

const Errors = require('../errors')

class Statistics {
  static async rescues (ctx) {
    let rescuesQuery = new RescueStatisticsQuery(ctx.query, ctx)
    let stats = rescuesQuery.toSequelize
    let result = await Rescue.scope(null).findAll(stats)
    let results = result.map((r) => { return r.toJSON() })
    return RescueStatisticsPresenter.render(results, ctx.meta(result, rescuesQuery))
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