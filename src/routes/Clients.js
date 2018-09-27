import { Client } from '../db'
import crypto from 'crypto'
import Query from '../query'
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
    let clientQuery = new Query({params: ctx.query, connection: ctx})
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    return Clients.presenter.render(result.rows, API.meta(result, clientQuery))
  }

  @GET('/clients/:id')
  @websocket('clients', 'read')
  @authenticated
  @parameters('id')
  async findById (ctx) {
    let clientQuery = new Query({params: { id: ctx.params.id }, connection: ctx})
    let result = await Client.findAndCountAll(clientQuery.toSequelize)

    this.requireWritePermission({connection: ctx, result})

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
    this.requireWritePermission({connection: ctx, entity: ctx.data})
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
    this.requireWritePermission({connection: ctx, entity: ctx.data})
    let client = await Client.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!client) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    this.requireWritePermission({connection: ctx, entity: client})

    await Client.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let clientQuery = new Query({ params: {id: ctx.params.id}, connection: ctx })
    let result = await Client.findAndCountAll(clientQuery.toSequelize)
    return Clients.presenter.render(result.rows, API.meta(result, clientQuery))
  }

  @DELETE('/clients/:id')
  @websocket('clients', 'delete')
  @authenticated
  @permissions('client.delete')
  @parameters('id')
  async delete (ctx) {
    let client = await Client.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!client) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    await client.destroy()

    ctx.status = 204
    return true
  }

  getReadPermissionFor ({connection, entity}) {
    if (entity.userId === connection.state.user.id || entity.userId === null) {
      return ['client.write.me', 'client.write']
    }
    return ['client.write']
  }

  getWritePermissionFor ({connection, entity}) {
    if (entity.userId === connection.state.user.id || entity.userId === null) {
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
