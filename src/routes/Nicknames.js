
import Permission from '../classes/Permission'
import { User, db } from '../db'
import NicknameQuery from '../query/NicknameQuery'
import { CustomPresenter} from '../classes/Presenters'
import { NotFoundAPIError, ConflictAPIError, ForbiddenAPIError } from '../classes/APIError'

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
    if (Permission.isAdmin(ctx.state.user)) {
      throw new ForbiddenAPIError({})
    }

    let { nicknames } = ctx.state.user.data.attributes
    if (nicknames.includes(ctx.data.nickname)) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nickname' })
    }

    if (nicknames.length > 0) {
      await NickServ.group(ctx.data.nickname, nicknames[0], ctx.data.password)
    } else {
      await NickServ.register(ctx.data.nickname, ctx.data.password, ctx.state.user.data.attributes.email)
      await NickServ.confirm(ctx.data.nickname)
    }

    let updatedNicknames = await NickServ.list(ctx.data.nickname)

    await User.update({ nicknames: db.cast(updatedNicknames, 'citext[]') }, {
      where: { id: ctx.state.user.data.id }
    })

    await HostServ.update(ctx.state.user)
    return true
  }

  @PUT('/nicknames')
  @websocket('nicknames', 'connect')
  @authenticated
  async connect (ctx) {
    let { nicknames } = ctx.state.user.data.attributes
    if (nicknames.includes(ctx.data.nickname)) {
      throw new ConflictAPIError({ pointer: '/data/attributes/nickname' })
    }

    await NickServ.identify(ctx.data.nickname, ctx.data.password)
    if (nicknames.length > 0) {
      await NickServ.group(ctx.data.nickname, nicknames[0], ctx.data.password)
    }

    let updatedNicknames = await NickServ.list(ctx.data.nickname)

    await User.update({ nicknames: db.cast(updatedNicknames, 'citext[]') }, {
      where: { id: ctx.state.user.data.id }
    })


    await HostServ.update(ctx.state.user)
    return true
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
    if (ctx.state.user.data.attributes.nicknames.includes(ctx.params.nickname) ||
      Permission.require(['nickname.delete'], ctx.state.user, ctx.state.scope)) {
      await NickServ.drop(ctx.params.nickname)

      let nicknames = await NickServ.list(ctx.state.user.data.attributes.nicknames[0])

      await User.update({
        nicknames: db.cast(nicknames, 'citext[]')
      }, {
        where: {
          id: ctx.state.user.data.id
        }
      })

      return true
    }
    return null
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