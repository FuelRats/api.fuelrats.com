'use strict'
const { Ship } = require('../db')
const ShipQuery = require('../Query/ShipQuery')
const { NotFoundAPIError } = require('../APIError')
const APIEndpoint = require('../APIEndpoint')


class Ships extends APIEndpoint {
  async search (ctx) {
    let shipsQuery = new ShipQuery(ctx.query, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)
    return Ships.presenter.render(result.rows, ctx.meta(result, shipsQuery))
  }

  async findById (ctx) {
    let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

    return Ships.presenter.render(result.rows, ctx.meta(result, shipsQuery))
  }

  async create (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let result = await Ship.create(ctx.data)

    ctx.response.status = 201
    let renderedResult = Ships.presenter.render(result, ctx.meta(result))
    process.emit('shipCreated', ctx, renderedResult)
    return renderedResult
  }

  async update (ctx) {
    this.requireWritePermission(ctx, ctx.data)

    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, ship)

    await Ship.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

    let renderedResult = Ships.presenter.render(result.rows, ctx.meta(result, shipsQuery))
    process.emit('shipUpdated', ctx, renderedResult)
    return renderedResult
  }

  async delete (ctx) {
    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, ship)

    await ship.destroy()
    return true
  }

  getWritePermissionForEntity (ctx, entity) {
    let rat = ctx.state.user.included.find((included) => {
      return included.id === entity.ratId
    })

    if (rat) {
      return ['ship.write.me', 'ship.write']
    } else {
      return ['ship.write.me']
    }
  }

  static get presenter () {
    class ShipsPresenter extends APIEndpoint.presenter {}
    ShipsPresenter.prototype.type = 'ships'
    return ShipsPresenter
  }
}

module.exports = Ships
