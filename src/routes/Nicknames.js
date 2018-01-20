
import Permission from '../classes/Permission'
import { User, db } from '../db'
import NicknameQuery from '../query/NicknameQuery'
import { CustomPresenter} from '../classes/Presenters'
import {NotFoundAPIError, ConflictAPIError, ForbiddenAPIError} from '../classes/APIError'

import NickServ from '../Anope/NickServ'
import HostServ from '../Anope/HostServ'
import API, {
  authenticated,
  GET,
  POST,
  PUT,
  DELETE,
  parameters,
} from '../classes/API'
import { websocket } from '../classes/WebSocket'
import Profile from './Profiles'
import UserQuery from '../query/UserQuery'

export default class Nicknames extends API {
  @GET('/nicknames/info/:nickname')
  @websocket('nicknames', 'info')
  @authenticated
  @parameters('nickname')
  async info (ctx) {
    let info = await NickServ.info(ctx.params.nickname)
    if (!info) {
      throw new NotFoundAPIError({ parameter: 'nickname' })
    }

    return Nicknames.presenter.render(info)
  }

  @POST('/nicknames')
  @websocket('nicknames', 'register')
  @authenticated
  async register (ctx) {
    /* if (Permission.isAdmin(ctx.state.user)) {
      throw new ForbiddenAPIError({})
    }*/

    ctx.data.nickname = ctx.data.nickname.toLowerCase()

    let { nicknames } = ctx.state.user
    if (nicknames.includes(ctx.data.nickname)) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nickname' })
    }

    if (nicknames.length > 0) {
      await NickServ.group(ctx.data.nickname, nicknames[0], ctx.data.password)
    } else {
      await NickServ.register(ctx.data.nickname, ctx.data.password, ctx.state.user.email)
      await NickServ.confirm(ctx.data.nickname)
    }

    let updatedNicknames = await NickServ.list(ctx.data.nickname)

    await User.update({ updatedNicknames }, {
      where: { id: ctx.state.user.id }
    })

    await HostServ.update(ctx.state.user)
    let userQuery = new UserQuery({ id: ctx.state.user.id }, ctx)
    let result = await User.scope('profile').findAndCountAll(userQuery.toSequelize)
    return Profile.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @PUT('/nicknames')
  @websocket('nicknames', 'connect')
  @authenticated
  async connect (ctx) {
    ctx.data.nickname = ctx.data.nickname.toLowerCase()
    let { nicknames } = ctx.state.user
    if (nicknames.includes(ctx.data.nickname)) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nickname' })
    }

    await NickServ.identify(ctx.data.nickname, ctx.data.password)
    if (nicknames.length > 0) {
      await NickServ.group(ctx.data.nickname, nicknames[0], ctx.data.password)
    }

    let updatedNicknames = await NickServ.list(ctx.data.nickname)

    await User.update({ nicknames: updatedNicknames }, {
      where: { id: ctx.state.user.id }
    })


    await HostServ.update(ctx.state.user)

    let userQuery = new UserQuery({ id: ctx.state.user.id }, ctx)
    let result = await User.scope('profile').findAndCountAll(userQuery.toSequelize)
    return Profile.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @GET('/nicknames/refresh')
  @websocket('nicknames', 'refresh')
  @authenticated
  async refresh (ctx) {
    let updatedNicknames = await NickServ.list(ctx.state.user.nicknames[0])

    await User.update({ nicknames: updatedNicknames }, {
      where: { id: ctx.state.user.id }
    })
    await HostServ.update(ctx.state.user)

    let userQuery = new UserQuery({ id: ctx.state.user.id }, ctx)
    let result = await User.scope('profile').findAndCountAll(userQuery.toSequelize)
    return Profile.presenter.render(result.rows, API.meta(result, userQuery))
  }

  @GET('/nicknames/:nickname')
  @websocket('nicknames', 'search')
  @authenticated
  @parameters('nickname')
  async search (ctx) {
    let result = await User.scope('public').findAndCountAll(new NicknameQuery(ctx.params, ctx).toSequelize)
    return Nicknames.presenter.render(result)
  }

  @DELETE('/nicknames/:nickname')
  @websocket('nicknames', 'delete')
  @authenticated
  @parameters('nickname')
  async delete (ctx) {
    ctx.params.nickname = ctx.params.nickname.toLowerCase()
    if (ctx.state.user.nicknames.includes(ctx.params.nickname) ||
      Permission.require(['user.write'], ctx.state.user, ctx.state.scope)) {
      await NickServ.drop(ctx.params.nickname)

      let nicknames = await NickServ.list(ctx.state.user.nicknames[0])

      await User.update({
        nicknames: nicknames
      }, {
        where: {
          id: ctx.state.user.id
        }
      })

      let userQuery = new UserQuery({ id: ctx.state.user.id }, ctx)
      let result = await User.scope('profile').findAndCountAll(userQuery.toSequelize)
      return Profile.presenter.render(result.rows, API.meta(result, userQuery))
    }
    throw ForbiddenAPIError({ parameter: 'nickname' })
  }

  static get presenter () {
    class NicknamesPresenter extends CustomPresenter {
      id (instance) {
        return instance.nickname
      }
    }
    NicknamesPresenter.prototype.type = 'nicknames'
    return NicknamesPresenter
  }
}
