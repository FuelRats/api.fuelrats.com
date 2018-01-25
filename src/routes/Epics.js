
import API, {
  GET,
  PUT,
  POST,
  DELETE,
  parameters,
  authenticated,
  permissions,
  required,
  disallow
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import { Epic } from '../db'
import Query from '../query'
import {ConflictAPIError, NotFoundAPIError} from '../classes/APIError'

class Epics extends API {
  @GET('/epics')
  @websocket('epics', 'search')
  @authenticated
  @permissions('epic.read')
  async search (ctx) {
    let epicsQuery = new Query(ctx.query, ctx)
    let result = await Epic.findAndCountAll(epicsQuery.toSequelize)
    return Epics.presenter.render(result.rows, API.meta(result, epicsQuery))
  }

  @GET('/epics/:id')
  @websocket('epics', 'read')
  @authenticated
  @permissions('epic.read')
  @parameters('id')
  async read (ctx) {
    let epicsQuery = new Query({id: ctx.params.id}, ctx)
    let result = await Epic.findAndCountAll(epicsQuery.toSequelize)

    return Epics.presenter.render(result.rows, API.meta(result, epicsQuery))
  }

  @POST('/epics')
  @websocket('epics', 'create')
  @authenticated
  @required('notes', 'ratId')
  @disallow('nominatedById', 'approvedById')
  async create (ctx) {
    if (ctx.data.rescueId) {
      let existing = await Epic.findOne({
        where: {
          ratId: ctx.data.ratId,
          rescueId: ctx.data.rescueId
        }
      })
      if (existing) {
        throw ConflictAPIError({
          pointer: '/data/attributes/rescueId'
        })
      }
    }

    ctx.data.nominatedById = ctx.state.user.id

    let result = await Epic.create(ctx.data)

    ctx.response.status = 201
    return Epics.presenter.render(result, API.meta(result))
  }

  @PUT('/epics/:id')
  @websocket('epics', 'update')
  @authenticated
  @permissions('epic.write')
  async update (ctx) {
    let epic = await Epic.findOne({
      where: { id: ctx.params.id }
    })

    if (!epic) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    if (ctx.data.rescueId) {
      let existing = await Epic.findOne({
        where: {
          ratId: ctx.data.ratId,
          rescueId: ctx.data.rescueId
        }
      })
      if (existing) {
        throw ConflictAPIError({
          pointer: '/data/attributes/rescueId'
        })
      }
    }

    await Epic.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let epicsQuery = new Query({id: ctx.params.id}, ctx)
    let result = await Epic.findAndCountAll(epicsQuery.toSequelize)
    return Epics.presenter.render(result.rows, API.meta(result, epicsQuery))
  }

  @DELETE('/epics/:id')
  @websocket('epics', 'delete')
  @authenticated
  @permissions('epic.delete')
  async delete (ctx) {
    let epic = await Epic.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!epic) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    epic.destroy()
    ctx.status = 204
    return true
  }

  static get presenter () {
    class EpicsPresenter extends API.presenter {}
    EpicsPresenter.prototype.type = 'epics'
    return EpicsPresenter
  }
}

module.exports =  Epics
