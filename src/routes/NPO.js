

import { Rat, User, npoMembership } from '../db'
import Users from '../routes/Users'
import Query from '../query'
import { NotFoundAPIError } from '../classes/APIError'

import API, {
  permissions,
  authenticated,
  GET,
  POST,
  DELETE,
  parameters
} from '../classes/API'
import { websocket } from '../classes/WebSocket'

export default class NPO extends API {
  @GET('/npo')
  @websocket('npo', 'search')
  @authenticated
  @permissions('user.read')
  async search (ctx) {
    let npoQuery = new Query(ctx.query, ctx)
    let result = await npoMembership.findAndCountAll(npoQuery.toSequelize)
    return NPO.presenter.render(result.rows, API.meta(result, npoQuery))
  }

  @GET('/npo/:id')
  @websocket('npo', 'read')
  @parameters('id')
  async findById (ctx) {
    let npoQuery = new Query({ userId: ctx.params.id }, ctx)
    let result = await Rat.findAndCountAll(npoQuery.toSequelize)

    return NPO.presenter.render(result.rows, API.meta(result, npoQuery))
  }

  @POST('/npo')
  @websocket('npo', 'join')
  @authenticated
  async create (ctx) {
    let result = await npoMembership.create({
      userId: ctx.state.user.id
    })

    ctx.response.status = 201
    return NPO.presenter.render(result, API.meta(result))
  }

  @DELETE('/npo')
  @websocket('npo', 'leave')
  @authenticated
  async delete (ctx) {
    let membership = await npoMembership.findOne({
      where: {
        userId: ctx.state.user.id
      }
    })

    if (!membership) {
      throw new NotFoundAPIError({ })
    }

    await membership.destroy()

    ctx.status = 204
    return true
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.id) {
      return ['user.write', 'user.write.me']
    }
    return ['user.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.userId === ctx.state.user.id) {
      return ['user.write', 'user.write.me']
    }
    return ['user.write']
  }

  static get presenter () {
    class npoPresenter extends API.presenter {
      relationships () {
        return {
          user: Users.presenter
        }
      }
    }
    npoPresenter.prototype.type = 'npoMembership'
    return npoPresenter
  }
}
