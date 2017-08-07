'use strict'

const db = require('../db').db
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const API = require('../classes/API')
const RescueStatisticsQuery = require('../Query/RescueStatisticsQuery')
const SystemStatisticsQuery = require('../Query/SystemStatisticsQuery')
const RatsStatisticsQuery = require('../Query/RatsStatisticsQuery')
const RescueStatisticsPresenter = require('../classes/Presenters').RescueStatisticsPresenter
const SystemStatisticsPresenter = require('../classes/Presenters').SystemStatisticsPresenter
const RatStatisticsPresenter = require('../classes/Presenters').RatStatisticsPresenter

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

  static async rats (ctx) {
    let ratsQuery = new RatsStatisticsQuery(ctx.query, ctx)
    let stats = ratsQuery.toSequelize
    let result = await Rat.scope('stats').findAll(stats)
    return RatStatisticsPresenter.render(result, ctx.meta(result, ratsQuery))
  }
}

module.exports = Statistics