'use strict'

const Error = require('../errors')
const Decal = require('../classes/Decal')
const User = require('../db').User
const Permission = require('../permission')
const DecalsPresenter = require('../classes/Presenters').DecalsPresenter

class Decals {
  static async check (ctx) {
    if (Object.keys(ctx.query).length > 0) {
      if (Permission.require(['user.read'], ctx.state.user, ctx.state.scope)) {
        let user = await User.findOne({
          where: ctx.query
        })

        if (!user) {
          throw Error.template('not_found', 'user')
        }

        await Decal.checkEligible(user)
        return {
          eligible: true
        }
      }
    } else {
      await Decal.checkEligible(ctx.user)
      return {
        eligible: true
      }
    }
  }

  static async redeem (ctx) {
    let decal = await Decal.getDecalForUser(ctx.user)
    return DecalsPresenter.render(decal)
  }
}



module.exports = Decals