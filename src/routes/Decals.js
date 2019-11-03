

import Decal from '../classes/Decal'
import { User } from '../db'
import API, {
  APIResource,
  authenticated,
  GET,
  permissions
} from '../classes/API'
import { NotFoundAPIError, UnsupportedMediaAPIError } from '../classes/APIError'
import { websocket } from '../classes/WebSocket'

/**
 *
 */
export default class Decals extends APIResource {
  /**
   * @inheritdoc
   */
  get type () {
    return 'decals'
  }

  async search (ctx) {

  }

  async findById () {

  }

  async create () {

  }

  async update () {

  }

  async delete () {

  }

  async redeem () {

  }

  /**
   *
   * @inheritdoc
   */
  changeRelationship ({ relationship }) {
    switch (relationship) {
      case 'displayRat':
        return {
          many: false,

          add ({ entity, id }) {
            return entity.addUser(id)
          },

          patch ({ entity, id }) {
            return entity.setUser(id)
          },

          remove ({ entity, id }) {
            return entity.removeUser(id)
          }
        }

      default:
        throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
    }
  }

  get relationTypes () {
    return {
      'user': 'users'
    }
  }


  isGroup ({ ctx, entity }) {
    return false
  }

  isInternal ({ ctx, entity }) {
    return false
  }

  isSelf ({ ctx, entity }) {
    return false
  }

  get writePermissionsForFieldAccess () {
    return undefined
  }
}
export class Decals2 extends API {
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
    let decal = await Decal.getDecalFor(ctx.state.user)
    return Decals.presenter.render(decal)
  }

  static get presenter () {
    class DecalsPresenter extends API.presenter {}
    DecalsPresenter.prototype.type = 'decals'
    return DecalsPresenter
  }
}
