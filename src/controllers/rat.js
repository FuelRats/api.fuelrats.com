

import { Rat } from '../db'
import RatQuery from '../Query/RatQuery'
import { CustomPresenter } from '../classes/Presenters'
import APIEndpoint from '../APIEndpoint'
import Ships from './ship'
import { NotFoundAPIError } from '../APIError'


class Rats extends APIEndpoint {
  async search (ctx) {
    let ratsQuery = new RatQuery(ctx.query, ctx)
    let result = await Rat.findAndCountAll(ratsQuery.toSequelize)
    return Rats.presenter.render(result.rows, ctx.meta(result, ratsQuery))
  }

  async findById (ctx) {
    let ratQuery = new RatQuery({id: ctx.params.id}, ctx)
    let result = await Rat.findAndCountAll(ratQuery.toSequelize)

    return Rats.presenter.render(result.rows, ctx.meta(result, ratQuery))
  }

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
    class RatsPresenter extends APIEndpoint.presenter {
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

module.exports = Rats
