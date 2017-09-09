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
  static async search (ctx) {
    let clientQuery = new ClientQuery(ctx.query, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    return ClientsPresenter.render(result.rows, ctx.meta(result, clientQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let clientQuery = new ClientQuery({ id: ctx.params.id }, ctx)
      let result = await Client.findAndCountAll(clientQuery.toSequelize)

      if (result.length === 0 || hasValidPermissionsForClient(ctx, result.rows[0], 'read')) {
        return ClientsPresenter.render(result.rows, ctx.meta(result, clientQuery))
      }
      throw Errors.template('no_permission', 'client.read')
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    let secret = crypto.randomBytes(32).toString('hex')
    let encryptedSecret = await bcrypt.hash(secret, 12)

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
    let renderedResult = ClientsPresenter.render(result, ctx.meta(result))
    process.emit('clientCreated', ctx, renderedResult)
    return renderedResult
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

      if (hasValidPermissionsForClient(ctx, client, 'write')) {
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
        let renderedResult = ClientsPresenter.render(result.rows, ctx.meta(result, clientQuery))
        process.emit('clientUpdated', ctx, renderedResult)
        return renderedResult
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

      process.emit('clientDeleted', ctx, ctx.params.id)
      ctx.status = 204
      return true
    }
  }
}

function hasValidPermissionsForClient (ctx, client, action = 'read') {
  let permissions = [`client.${action}`]
  if (client.id === ctx.state.user.data.id) {
    permissions.push(`client.${action}.me`)
  }

  return Permission.require(permissions, ctx.state.user, ctx.state.scope)
}

module.exports = Clients
