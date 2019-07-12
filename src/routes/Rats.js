

import { Rat } from '../db'
import Query from '../query'
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
  protect, WritePermission
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

export default class Rats extends API {
  @GET('/rats')
  @websocket('rats', 'search')
  async search (ctx) {
    let ratsQuery = new Query({params: ctx.query, connection: ctx})
    let result = await Rat.findAndCountAll(ratsQuery.toSequelize)
    return Rats.presenter.render(result.rows, API.meta(result, ratsQuery))
  }

  @GET('/rats/:id')
  @websocket('rats', 'read')
  @parameters('id')
  async findById (ctx) {
    let ratQuery = new Query({params: {id: ctx.params.id}, connection: ctx})
    let result = await Rat.findAndCountAll(ratQuery.toSequelize)

    return Rats.presenter.render(result.rows, API.meta(result, ratQuery))
  }

  @POST('/rats')
  @websocket('rats', 'create')
  @authenticated
  async create (ctx) {
    this.requireWritePermission({ connection: ctx, entity: ctx.data })

    if (!ctx.data.userId) {
      ctx.data.userId = ctx.state.user.id
    }

    let result = await Rat.create(ctx.data)

    ctx.response.status = 201
    let renderedResult = Rats.presenter.render(result, API.meta(result))
    process.emit('ratCreated', ctx, renderedResult)
    return renderedResult
  }

  @PUT('/rats')
  @websocket('rats', 'update')
  @authenticated
  @parameters('id')
  @protect('rat.write', 'platform')
  async update (ctx) {
    this.requireWritePermission({ connection: ctx, entity: ctx.data })

    let rat = await Rat.findOne({
      where: { id: ctx.params.id }
    })

    if (!rat) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({ connection: ctx, entity: rat })

    await Rat.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let ratQuery = new Query({ params: {id: ctx.params.id}, connection: ctx })
    let result = await Rat.findAndCountAll(ratQuery.toSequelize)
    let renderedResult = Rats.presenter.render(result.rows, API.meta(result, ratQuery))
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

    await rat.destroy()

    process.emit('ratDeleted', ctx, CustomPresenter.render({
      id: ctx.params.id
    }))
    ctx.status = 204
    return true
  }

  get writePermissionsForFieldAccess () {
    return {
      name: WritePermission.group,
      data: WritePermission.group,
      platform: WritePermission.group,
      createdAt: WritePermission.internal,
      updatedAt: WritePermission.internal,
      deletedAt: WritePermission.internal
    }
  }

  getReadPermissionFor ({ connection, entity }) {
    if (entity.userId === connection.state.user.id) {
      return ['rat.write', 'rat.write.me']
    }
    return ['rat.write']
  }

  getWritePermissionFor ({ connection, entity }) {
    if (entity.userId === connection.state.user.id) {
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
