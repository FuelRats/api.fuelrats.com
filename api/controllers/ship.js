'use strict'
const { Ship } = require('../db')
const ShipQuery = require('../Query/ShipQuery')
const { ShipsPresenter } = require('../classes/Presenters')

const Errors = require('../errors')
const Permission = require('../permission')

class Ships {
  static async search (ctx) {
    let shipsQuery = new ShipQuery(ctx.query, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)
    return ShipsPresenter.render(result.rows, ctx.meta(result, shipsQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
      let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

      return ShipsPresenter.render(result.rows, ctx.meta(result, shipsQuery))
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    if (!isSelShipOrHasPermission(ctx, ctx.data)) {
      throw Errors.template('no_permission', ['ship.write'])
    }

    let result = await Ship.create(ctx.data)
    if (!result) {
      throw Error.template('operation_failed')
    }

    ctx.response.status = 201
    let renderedResult = ShipsPresenter.render(result, ctx.meta(result))
    process.emit('shipCreated', ctx, renderedResult)
    return renderedResult
  }

  static async update (ctx) {
    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw Error.template('not_found', ctx.params.id)
    }

    if (!isSelShipOrHasPermission(ctx, ship)) {
      throw Errors.template('no_permission', ['ship.write'])
    }

    if (ctx.data.ratId && !isSelShipOrHasPermission(ctx, ctx.data)) {
      throw Errors.template('no_permission', ['ship.write'])
    }

    await Ship.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

    let renderedResult = ShipsPresenter.render(result.rows, ctx.meta(result, shipsQuery))
    process.emit('shipUpdated', ctx, renderedResult)
    return renderedResult
  }

  static async delete (ctx) {
    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw Error.template('not_found', ctx.params.id)
    }

    if (!isSelShipOrHasPermission(ctx, ctx.data)) {
      throw Errors.template('no_permission', ['ship.write'])
    }

    await ship.destroy()
    return true
  }
}

function isSelShipOrHasPermission (ctx, ship) {
  let rat = ctx.state.user.included.find((included) => {
    return included.id === ship.ratId
  })

  return rat || Permission.granted(['ship.write'], ctx.state.user, ctx.state.scope)
}

module.exports = Ships
