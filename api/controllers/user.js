'use strict'

const User = require('../db').User

const Error = require('../errors')
const Permission = require('../permission')
const UserQuery = require('../Query/UserQuery')
const UsersPresenter = require('../classes/Presenters').UsersPresenter

class Users {
  static async search (ctx) {
    let rescueQuery = new UserQuery(ctx.query, ctx)
    let result = await User.findAndCountAll(rescueQuery.toSequelize)
    return UsersPresenter.render(result.rows, ctx.meta(result, rescueQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
      let result = await User.findAndCountAll(userQuery.toSequelize)

      if (result.rows.length === 0 || hasValidPermissionsForUser(ctx, result.rows[0], 'read')) {
        return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    let result = await User.create(ctx.data)
    if (!result) {
      throw Error.template('operation_failed')
    }

    ctx.response.status = 201
    return UsersPresenter.render(result, ctx.meta(result))
  }

  static async update (ctx) {
    if (ctx.params.id) {
      let user = await User.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!user) {
        throw Error.template('not_found', ctx.params.id)
      }

      if (hasValidPermissionsForUser(ctx, user, 'write')) {
        let rescue = await User.update(ctx.data, {
          where: {
            id: ctx.params.id
          }
        })

        if (!rescue) {
          throw Error.template('operation_failed')
        }

        let userQuery = new UserQuery({id: ctx.params.id}, ctx)
        let result = await User.findAndCountAll(userQuery.toSequelize)
        return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async delete (ctx) {
    if (ctx.params.id) {
      let rescue = await User.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!rescue) {
        throw Error.template('not_found', ctx.params.id)
      }

      rescue.destroy()
      ctx.status = 204
      return true
    }
  }
}

function hasValidPermissionsForUser (ctx, user, action = 'read') {
  let permissions = [`user.${action}`]
  if (user.id === ctx.state.user.data.id) {
    permissions.push(`user.${action}.me`)
  }

  return Permission.require(permissions, ctx.state.user, ctx.state.scope)
}

module.exports = Users
