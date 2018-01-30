import { Client } from '../db'
import crypto from 'crypto'
import ClientQuery from '../query/ClientQuery'
import Users from './Users'
import { NotFoundAPIError } from '../classes/APIError'
import API, {
  permissions,
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
  disallow,
  required,
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

const CLIENT_SECRET_LENGTH = 32

export default class Clients extends API {
  @GET('/clients')
  @websocket('clients', 'search')
  @authenticated
  @permissions('client.read')
  async search (ctx) {
    let clientQuery = new ClientQuery(ctx.query, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    return Clients.presenter.render(result.rows, API.meta(result, clientQuery))
  }

  @GET('/clients/:id')
  @websocket('clients', 'read')
  @authenticated
  @parameters('id')
  async findById (ctx) {
    let clientQuery = new ClientQuery({ id: ctx.params.id }, ctx)
    let result = await Client.findAndCountAll(clientQuery.toSequelize)

    this.requireWritePermission(ctx, result)

    return Clients.presenter.render(result.rows, API.meta(result, clientQuery))
  }

  @POST('/clients')
  @websocket('clients', 'create')
  @authenticated
  @required('name')
  @disallow('secret')
  async create (ctx) {
    if (!ctx.data.userId) {
      ctx.data.userId = ctx.state.user.id
    }
    this.requireWritePermission(ctx, ctx.data)
    let secret = crypto.randomBytes(CLIENT_SECRET_LENGTH).toString('hex')
    ctx.data.secret = secret
    let result = await Client.create(ctx.data)
    result.secret = secret

    ctx.response.status = 201
    return Clients.presenter.render(result, API.meta(result))
  }

  @PUT('/clients/:id')
  @websocket('clients', 'update')
  @authenticated
  @parameters('id')
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
    return Clients.presenter.render(result.rows, API.meta(result, clientQuery))
  }

  @DELETE('/clients/:id')
  @websocket('clients', 'delete')
  @authenticated
  @permissions('client.delete')
  @parameters('id')
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

    ctx.status = 204
    return true
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.id || entity.userId === null) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.id || entity.userId === null) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
  }

  static get presenter () {
    class ClientsPresenter extends API.presenter {
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
