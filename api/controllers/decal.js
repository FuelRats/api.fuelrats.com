'use strict'

const Decal = require('../classes/Decal')
const { User } = require('../db')
const APIEndpoint = require('../APIEndpoint')
const { NotFoundAPIError } = require('../APIError')

class Decals extends APIEndpoint {
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
      let eligible = await Decal.checkEligible(ctx.state.user.data)
      if (eligible.id) {
        return Decals.presenter.render(eligible)
      }
      return eligible
    }
  }

  async redeem (ctx) {
    let decal = await Decal.getDecalForUser(ctx.state.user.data)
    return Decals.presenter.render(decal)
  }

  getReadPermissionForEntity (ctx, entity) {
    if (entity.id === ctx.state.user.data.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  getWritePermissionForEntity (ctx, entity) {
    if (entity.id === ctx.state.user.data.id) {
      return ['user.write.me', 'user.write']
    }
    return ['user.write']
  }

  static get presenter () {
    class DecalsPresenter extends APIEndpoint.presenter {}
    DecalsPresenter.prototype.type = 'decals'
    return DecalsPresenter
  }
}



module.exports = Decals