'use strict'

const Rat = require('../db').Rat

const Errors = require('../errors')
const Permission = require('../permission')
const RatQuery = require('../Query/RatQuery')
const RatsPresenter = require('../classes/Presenters').RatsPresenter

class Rats {
  static async search (ctx) {
    let ratsQuery = new RatQuery(ctx.query, ctx)
    let result = await Rat.findAndCountAll(ratsQuery.toSequelize)
    return RatsPresenter.render(result.rows, ctx.meta(result, ratsQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let ratQuery = new RatQuery({ id: ctx.params.id }, ctx)
      let result = await Rat.findAndCountAll(ratQuery.toSequelize)

      if (result.rows.length === 0 || hasValidPermissionsForRat(ctx, result.rows[0])) {
        return RatsPresenter.render(result.rows, ctx.meta(result, ratQuery))
      }
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
    return RatsPresenter.render(result, ctx.meta(result))
  }

  static async update (ctx) {
    if (ctx.params.id) {
      let client = await Rat.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!client) {
        throw Error.template('not_found', ctx.params.id)
      }

      if (hasValidPermissionsForRat(ctx, client, 'write')) {
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
        return RatsPresenter.render(result.rows, ctx.meta(result, ratQuery))
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static delete (params) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rat.findOne({
          where: {
            id: params.id
          }
        }).then(function (rat) {
          if (!rat) {
            return reject(Error.template('not_found', params.id))
          }

          rat.destroy()

          resolve(null)
        }).catch(function (err) {
          reject({ error: Errors.throw('server_error', err), meta: {} })
        })
      }
    })
  }
}

function hasValidPermissionsForRat (ctx, rat, action = 'write') {
  let permissions = [`rat.${action}`]
  if (rat.userId === ctx.state.user.data.id) {
    permissions.push(`rat.${action}.me`)
  }

  return Permission.require(permissions, ctx.state.user, ctx.state.scope)
}

module.exports = Rats
