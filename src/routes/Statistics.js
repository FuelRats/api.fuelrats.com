

import { Rat, Rescue } from '../db'
import API, {
  GET
} from '../classes/API'
import { websocket } from '../classes/WebSocket'


export default class Statistics extends API {
  @GET('/statistics/rescues')
  @websocket('statistics', 'rescues')
  async rescues (ctx) {
    let rescuesQuery = new RescueStatisticsQuery(ctx.query, ctx)
    let result = await Rescue.scope(null).findAll(rescuesQuery.toSequelize)
    let results = result.map((result) => { return result.toJSON() })
    return RescueStatisticsPresenter.render(results, API.meta(result, rescuesQuery))
  }

  @GET('/statistics/systems')
  @websocket('statistics', 'systems')
  async systems (ctx) {
    let systemQuery = new SystemStatisticsQuery(ctx.query, ctx)
    let result = await Rescue.scope(null).findAll(systemQuery.toSequelize)
    let results = result.map((result) => { return result.toJSON() })
    return SystemStatisticsPresenter.render(results, API.meta(result, systemQuery))
  }

  @GET('/statistics/rats')
  @websocket('statistics', 'rats')
  async rats (ctx) {
    let ratsQuery = new RatsStatisticsQuery(ctx.query, ctx)
    let result = await Rat.scope(null).findAll(ratsQuery.toSequelize)
    return RatStatisticsPresenter.render(result, API.meta(result, ratsQuery))
  }
}

