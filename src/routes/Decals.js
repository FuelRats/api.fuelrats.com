

import Decal from '../classes/Decal'
import { User } from '../db'
import API, {
  authenticated,
  GET,
  permissions
} from '../classes/API'
import { NotFoundAPIError } from '../classes/APIError'
import { websocket } from '../classes/WebSocket'

export default class Decals extends API {
  @GET('/decals/check')
  @websocket('decals', 'check')
  @authenticated
  @permissions('user.read.me')
  async check (ctx) {
    if (Object.keys(ctx.query).length > 0) {
      let user = await User.findOne({
        where: ctx.query
      })

      if (!user) {
        throw new NotFoundAPIError({ parameter: 'id' })
      }

      this.requireReadPermission(ctx, user)

      let eligible = await Decal.checkEligible(user)
      if (eligible.id) {
        return Decals.presenter.render(eligible)
      }
      return eligible
    } else {
      let eligible = await Decal.checkEligible(ctx.state.user)
      if (eligible.id) {
        return Decals.presenter.render(eligible)
      }
      return eligible
    }
  }

  @GET('/decals/redeem')
  @websocket('decals', 'redeem')
  @authenticated
  @permissions('user.write.me')
  async redeem (ctx) {
    let decal = await Decal.getDecalForUser(ctx.state.user)
    return Decals.presenter.render(decal)
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.id === ctx.state.user.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.id === ctx.state.user.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  static get presenter () {
    class DecalsPresenter extends API.presenter {}
    DecalsPresenter.prototype.type = 'decals'
    return DecalsPresenter
  }
}
