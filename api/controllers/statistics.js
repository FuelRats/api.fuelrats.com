'use strict'

const db = require('../db').db
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const API = require('../classes/API')
const RescueStatisticsQuery = require('../Query/RescueStatisticsQuery')
const SystemStatisticsQuery = require('../Query/SystemStatisticsQuery')
const RescueStatisticsPresenter = require('../classes/Presenters').RescueStatisticsPresenter
const SystemStatisticsPresenter = require('../classes/Presenters').SystemStatisticsPresenter

const Errors = require('../errors')

class Statistics {
  static async rescues (ctx) {
    let rescuesQuery = new RescueStatisticsQuery(ctx.query, ctx)
    let stats = rescuesQuery.toSequelize
    let result = await Rescue.scope(null).findAll(stats)
    let results = result.map((r) => { return r.toJSON() })
    return RescueStatisticsPresenter.render(results, ctx.meta(result, rescuesQuery))
  }


  static async systems (ctx) {
    let systemQuery = new SystemStatisticsQuery(ctx.query, ctx)
    let stats = systemQuery.toSequelize
    let result = await Rescue.scope(null).findAll(stats)
    let results = result.map((r) => { return r.toJSON() })
    return SystemStatisticsPresenter.render(results, ctx.meta(result, systemQuery))
  }
}

module.exports = Statistics