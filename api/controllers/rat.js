'use strict'

const { Rat } = require('../db')
const Permission = require('../permission')
const RatQuery = require('../Query/RatQuery')
const { RatsPresenter, CustomPresenter } = require('../classes/Presenters')

class Rats {
  static async search (ctx) {
    let ratsQuery = new RatQuery(ctx.query, ctx)
    let result = await Rat.findAndCountAll(ratsQuery.toSequelize)
    return RatsPresenter.render(result.rows, ctx.meta(result, ratsQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let ratQuery = new RatQuery({id: ctx.params.id}, ctx)
      let result = await Rat.findAndCountAll(ratQuery.toSequelize)

      return RatsPresenter.render(result.rows, ctx.meta(result, ratQuery))
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    if (!Permission.granted(['user.write'], ctx.state.user, ctx.state.scope)) {
      ctx.data.userId = ctx.state.user.data.id
    }

    let result = await Rat.create(ctx.data)
    if (!result) {
      throw Error.template('operation_failed')
    }

    ctx.response.status = 201
    let renderedResult = RatsPresenter.render(result, ctx.meta(result))
    process.emit('ratCreated', ctx, renderedResult)
    return renderedResult
  }

  static async update (ctx) {
    if (ctx.params.id) {
      let rat = await Rat.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!rat) {
        throw Error.template('not_found', ctx.params.id)
      }

      if (hasValidPermissionsForRat(ctx, rat, 'write')) {
        if (!Permission.granted(['rat.write'], ctx.state.user, ctx.state.scope)) {
          delete ctx.data.userId
        }

        let rescue = await Rat.update(ctx.data, {
          where: {
            id: ctx.params.id
          }
        })

        if (!rescue) {
          throw Error.template('operation_failed')
        }

        let ratQuery = new RatQuery({id: ctx.params.id}, ctx)
        let result = await Rat.findAndCountAll(ratQuery.toSequelize)
        let renderedResult = RatsPresenter.render(result.rows, ctx.meta(result, ratQuery))
        process.emit('ratUpdated', ctx, renderedResult)
        return renderedResult
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async delete (ctx) {
    if (ctx.params.id) {
      let rat = await Rat.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!rat) {
        throw Error.template('not_found', ctx.params.id)
      }

      if (hasValidPermissionsForRat(ctx, rat, 'write')) {
        rat.destroy()

        process.emit('ratDeleted', ctx, CustomPresenter.render({
          id: ctx.params.id
        }))
        ctx.status = 204
        return true
      }
    }
  }
}

/**
 * Check whether the user has permission to perform the specified action for this rat
 * @param ctx the request object to validate
 * @param rat the rat to check permissions for
 * @param action the action to perform
 * @returns {boolean} Whether the user has permission
 */
function hasValidPermissionsForRat (ctx, rat, action = 'write') {
  let permissions = [`rat.${action}`]
  if (rat.userId === ctx.state.user.data.id) {
    permissions.push(`rat.${action}.me`)
  }

  return Permission.require(permissions, ctx.state.user, ctx.state.scope)
}

module.exports = Rats
