

import { Rat, Rescue } from '../db'
import RescueStatisticsQuery from '../query/RescueStatisticsQuery'
import SystemStatisticsQuery from '../query/SystemStatisticsQuery'
import RatsStatisticsQuery from '../query/RatsStatisticsQuery'
import { CustomPresenter } from '../classes/Presenters'
import API, {
  GET,
  websocket
} from '../classes/API'


export default class Statistics extends API {
  @GET('/statistics/rescues')
  @websocket('statistics', 'rescues')
  async rescues (ctx) {
    let rescuesQuery = new RescueStatisticsQuery(ctx.query, ctx)
    let result = await Rescue.scope(null).findAll(rescuesQuery.toSequelize)
    let results = result.map((result) => { return result.toJSON() })
    return RescueStatisticsPresenter.render(results, ctx.meta(result, rescuesQuery))
  }

  @GET('/statistics/systems')
  @websocket('statistics', 'systems')
  async systems (ctx) {
    let systemQuery = new SystemStatisticsQuery(ctx.query, ctx)
    let result = await Rescue.scope(null).findAll(systemQuery.toSequelize)
    let results = result.map((result) => { return result.toJSON() })
    return SystemStatisticsPresenter.render(results, ctx.meta(result, systemQuery))
  }

  @GET('/statistics/rats')
  @websocket('statistics', 'rats')
  async rats (ctx) {
    let ratsQuery = new RatsStatisticsQuery(ctx.query, ctx)
    let result = await Rat.scope('stats').findAll(ratsQuery.toSequelize)
    return RatStatisticsPresenter.render(result, ctx.meta(result, ratsQuery))
  }
}


class RescueStatisticsPresenter extends CustomPresenter {
  id (instance) {
    return instance.date || null
  }
}
RescueStatisticsPresenter.prototype.type = 'rescuestatistics'

class SystemStatisticsPresenter extends CustomPresenter {
  id (instance) {
    return instance.system || null
  }
}
SystemStatisticsPresenter.prototype.type = 'systemstatistics'

class RatStatisticsPresenter extends CustomPresenter {
  id (instance) {
    return instance.id || null
  }
}
RatStatisticsPresenter.prototype.type = 'ratstatistics'
