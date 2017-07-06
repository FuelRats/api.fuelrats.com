'use strict'

const Client = require('../db').Client
const Permission = require('../permission')
const Errors = require('../errors')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const BotServ = require('../Anope/BotServ')
const ClientQuery = require('../Query/ClientQuery')
const ClientsPresenter = require('../classes/Presenters').ClientsPresenter

class Clients {
  static async read (ctx) {
    let clientQuery = new ClientQuery(ctx.query, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    return ClientsPresenter.render(result.rows, ctx.meta(result, clientQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let clientQuery = new ClientQuery({ id: ctx.params.id }, ctx)
      let result = await Client.findAndCountAll(clientQuery.toSequelize)

      if (result.length === 0 || hasValidPermissionsForClient(result[0])) {
        return ClientsPresenter.render(result.rows, ctx.meta(result, clientQuery))
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    let secret = crypto.randomBytes(32).toString('hex')
    let encryptedSecret = await bcrypt.hash(secret, 16)

    ctx.data = Object.assign(ctx.data, {
      secret: encryptedSecret,
      userId: ctx.state.user.data.id
    })
    let result = await Client.create(ctx.data)
    result.secret = secret
    if (!result) {
      throw Error.template('operation_failed')
    }

    ctx.response.status = 201
    return ClientsPresenter.render(result, ctx.meta(result))
  }

  static async update (ctx) {
    if (ctx.params.id) {
      let client = await Client.findOne({
        where: {
          id: ctx.params.id
        }
      })

      if (!client) {
        throw Error.template('not_found', ctx.params.id)
      }

      if (hasValidPermissionsForClient(ctx, client)) {
        if (!Permission.granted(['client.write'], ctx.state.user, ctx.state.scope)) {
          delete ctx.data.userId
          delete ctx.data.secret
        }

        let rescue = await Client.update(ctx.data, {
          where: {
            id: ctx.params.id
          }
        })

        if (!rescue) {
          throw Error.template('operation_failed')
        }

        let clientQuery = new ClientQuery({id: ctx.params.id}, ctx)
        let result = await Client.findAndCountAll(clientQuery.toSequelize)
        return ClientsPresenter.render(result.rows, ctx.meta(result, clientQuery))
      }
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async delete (ctx) {
    if (ctx.params.id) {
      let rescue = await Client.findOne({
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

function hasValidPermissionsForClient (ctx, client) {
  let permissions = ['client.write']
  if (client.user.id === ctx.state.user.id) {
    permissions.push('client.write.me')
  }

  return Permission.require(permissions, ctx.state.user, ctx.state.scope)
}

module.exports = Clients
