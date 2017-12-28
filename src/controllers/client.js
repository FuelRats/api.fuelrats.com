'use strict'

const { Client } = require('../db')
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const ClientQuery = require('../Query/ClientQuery')
const APIEndpoint = require('../APIEndpoint')
const Users = require('./user')
const { NotFoundAPIError } = require('../APIError')

const CLIENT_SECRET_LENGTH = 32
const BCRYPT_ROUNDS_COUNT = 12

class Clients extends APIEndpoint {
  async search (ctx) {
    let clientQuery = new ClientQuery(ctx.query, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    return Clients.presenter.render(result.rows, ctx.meta(result, clientQuery))
  }

  async findById (ctx) {
    let clientQuery = new ClientQuery({ id: ctx.params.id }, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)

    this.requireWritePermission(ctx, result)

    return Clients.presenter.render(result.rows, ctx.meta(result, clientQuery))
  }

  async create (ctx) {
    this.requireWritePermission(ctx, ctx.data)
    let secret = crypto.randomBytes(CLIENT_SECRET_LENGTH).toString('hex')
    ctx.data.secret = await bcrypt.hash(secret, BCRYPT_ROUNDS_COUNT)
    if (!ctx.data.userId) {
      ctx.data.userId = ctx.state.user.data.id
    }
    let result = await Client.create(ctx.data)
    result.secret = secret

    ctx.response.status = 201
    let renderedResult = Clients.presenter.render(result, ctx.meta(result))
    process.emit('clientCreated', ctx, renderedResult)
    return renderedResult
  }

  async update (ctx) {
    this.requireWritePermission(ctx, ctx.data)
    let client = await Client.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!client) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission(ctx, client)

    await Client.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let clientQuery = new ClientQuery({id: ctx.params.id}, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    let renderedResult = Clients.presenter.render(result.rows, ctx.meta(result, clientQuery))
    process.emit('clientUpdated', ctx, renderedResult)
    return renderedResult
  }

  async delete (ctx) {
    let rescue = await Client.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    rescue.destroy()

    process.emit('clientDeleted', ctx, ctx.params.id)
    ctx.status = 204
    return true
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.data.id) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.data.id) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
  }

  static get presenter () {
    class ClientsPresenter extends APIEndpoint.presenter {
      relationships () {
        return {
          user: Users.presenter
        }
      }
    }
    ClientsPresenter.prototype.type = 'clients'
    return ClientsPresenter
  }
}

module.exports = Clients
