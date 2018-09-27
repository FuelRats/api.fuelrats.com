
import API, {
  GET,
  PUT,
  POST,
  DELETE,
  parameters,
  authenticated,
  permissions,
  required
} from '../classes/API'

import {Group, User } from '../db'
import Query from '../query'
import { websocket } from '../classes/WebSocket'
import {NotFoundAPIError} from '../classes/APIError'
import Users from './Users'

export default class Groups extends API {
  @GET('/groups')
  @websocket('groups', 'search')
  @authenticated
  @permissions('group.read')
  async search (ctx) {
    let groupsQuery = new Query({ params: ctx.query, connection: ctx })
    let result = await Group.findAndCountAll(groupsQuery.toSequelize)
    return Groups.presenter.render(result.rows, API.meta(result, groupsQuery))
  }

  @GET('/groups/:id')
  @websocket('groups', 'read')
  @authenticated
  @permissions('group.read')
  @parameters('id')
  async read (ctx) {
    let groupsQuery = new Query({ params: {id: ctx.params.id}, connection: ctx })
    let result = await Group.findAndCountAll(groupsQuery.toSequelize)

    return Groups.presenter.render(result.rows, API.meta(result, groupsQuery))
  }

  @POST('/groups')
  @websocket('groups', 'create')
  @authenticated
  @permissions('group.write')
  @required('id', 'priority', 'permissions')
  async create (ctx) {
    let result = await Group.create(ctx.data)

    ctx.response.status = 201
    return Groups.presenter.render(result, API.meta(result))
  }

  @PUT('/groups/:id')
  @websocket('groups', 'update')
  @authenticated
  @permissions('group.write')
  @parameters('id')
  async update (ctx) {
    let group = await Group.findOne({
      where: { id: ctx.params.id }
    })

    if (!group) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    await Group.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    let groupsQuery = new Query({ params: {id: ctx.params.id}, connection: ctx })
    let result = await Group.findAndCountAll(groupsQuery.toSequelize)
    return Groups.presenter.render(result.rows, API.meta(result, groupsQuery))
  }

  @DELETE('/groups/:id')
  @websocket('groups', 'delete')
  @authenticated
  @permissions('group.delete')
  @parameters('id')
  async delete (ctx) {
    let group = await Group.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!group) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    group.destroy()
    ctx.status = 204
    return true
  }

  @POST('/groups/:id/:userId')
  @websocket('groups', 'grant')
  @authenticated
  @permissions('group.write')
  @parameters('id', 'userId')
  async grant (ctx) {
    let group = await Group.findOne({
      where: { id: ctx.params.id }
    })

    if (!group) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    let user = await User.findOne({
      where: { id: ctx.params.userId }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'userId' })
    }

    await user.addGroup(group)
    let userQuery = new Query({ params: { id: ctx.params.userId }, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)

    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @DELETE('/groups/:id/:userId')
  @websocket('groups', 'revoke')
  @authenticated
  @permissions('group.write')
  @parameters('id', 'userId')
  async revoke (ctx) {
    let group = await Group.findOne({
      where: { id: ctx.params.id }
    })

    if (!group) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }

    let user = await User.findOne({
      where: { id: ctx.params.userId }
    })

    if (!user) {
      throw new NotFoundAPIError({ parameter: 'userId' })
    }

    await user.removeGroup(group)
    let userQuery = new Query({ params: { id: ctx.params.userId }, connection: ctx })
    let result = await User.scope('public').findAndCountAll(userQuery.toSequelize)

    return Users.presenter.render(result.rows, API.meta(result, userQuery))
  }

  static get presenter () {
    class GroupsPresenter extends API.presenter {}
    GroupsPresenter.prototype.type = 'groups'
    return GroupsPresenter
  }
}

