

import { Rat } from '../db'
import RatQuery from '../query/RatQuery'
import { CustomPresenter } from '../classes/Presenters'
import Ships from './Ships'
import { NotFoundAPIError } from '../classes/APIError'

import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  websocket
} from '../classes/API'

export default class Rats extends API {
  @GET('/rats')
  @websocket('rats', 'search')
  async search (ctx) {
    let ratsQuery = new RatQuery(ctx.query, ctx)
    let result = await Rat.findAndCountAll(ratsQuery.toSequelize)
    return Rats.presenter.render(result.rows, ctx.meta(result, ratsQuery))
  }

  @GET('/rats/:id')
  @websocket('rats', 'read')
  @parameters('id')
  async findById (ctx) {
    let ratQuery = new RatQuery({id: ctx.params.id}, ctx)
    let result = await Rat.findAndCountAll(ratQuery.toSequelize)

    return Rats.presenter.render(result.rows, ctx.meta(result, ratQuery))
  }

  @POST('/rats')
  @websocket('rats', 'create')
  @authenticated
  async create (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    if (!ctx.data.userId) {
      ctx.data.userId = ctx.state.user.data.id
    }

    let result = await Rat.create(ctx.data)

    ctx.response.status = 201
    let renderedResult = Rats.presenter.render(result, ctx.meta(result))
    process.emit('ratCreated', ctx, renderedResult)
    return renderedResult
  }

  @PUT('/rats')
  @websocket('rats', 'update')
  @authenticated
  @parameters('id')
  async update (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let rat = await Rat.findOne({
      where: { id: ctx.params.id }
    })

    if (!rat) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, rat)

    await Rat.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let ratQuery = new RatQuery({id: ctx.params.id}, ctx)
    let result = await Rat.findAndCountAll(ratQuery.toSequelize)
    let renderedResult = Rats.presenter.render(result.rows, ctx.meta(result, ratQuery))
    process.emit('ratUpdated', ctx, renderedResult)
    return renderedResult
  }

  @DELETE('/rats/:id')
  @websocket('rats', 'delete')
  @authenticated
  @permissions('rat.delete')
  @parameters('id')
  async delete (ctx) {
    let rat = await Rat.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rat) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    rat.destroy()

    process.emit('ratDeleted', ctx, CustomPresenter.render({
      id: ctx.params.id
    }))
    ctx.status = 204
    return true
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.data.id) {
      return ['rat.write', 'rat.write.me']
    }
    return ['rat.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.data.id) {
      return ['rat.write', 'rat.write.me']
    }
    return ['rat.write']
  }

  static get presenter () {
    class RatsPresenter extends API.presenter {
      relationships () {
        return {
          ships: Ships.presenter
        }
      }
    }
    RatsPresenter.prototype.type = 'rats'
    return RatsPresenter
  }
}