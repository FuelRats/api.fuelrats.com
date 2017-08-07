'use strict'

const User = require('../db').User

const Error = require('../errors')
const Permission = require('../permission')
const UserQuery = require('../Query/UserQuery')
const HostServ = require('../Anope/HostServ')
const UsersPresenter = require('../classes/Presenters').UsersPresenter

class Users {
  static async search (ctx) {
    let userQuery = new UserQuery(ctx.query, ctx)
    let result = await User.findAndCountAll(userQuery.toSequelize)
    return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)

      if (result.rows.length === 0 || hasValidPermissionsForUser(ctx, result.rows[0], 'read')) {
        return UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
      }

      throw Error.template('no_permission', 'client.read')
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

    let renderedResult = UsersPresenter.render(result, ctx.meta(result))
    process.emit('userCreated', ctx, renderedResult)
    return renderedResult
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
        let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
        let renderedResult = UsersPresenter.render(result.rows, ctx.meta(result, userQuery))
        process.emit('userUpdated', ctx, renderedResult)
        return renderedResult
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

      process.emit('userDeleted', ctx, ctx.params.id)
      ctx.status = 204
      return true
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async updatevirtualhost (ctx) {
    if (ctx.params.id) {
      let userQuery = new UserQuery({ id: ctx.params.id }, ctx)
      let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)
      if (result) {
        return HostServ.update(result)
      }
      throw Error.template('not_found', 'id')
    } else {
      throw Error.template('missing_required_field', 'id')
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
