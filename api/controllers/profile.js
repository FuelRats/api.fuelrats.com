'use strict'
const User = require('../db').User
const ProfilesPresenter = require('../classes/Presenters').ProfilesPresenter

class Profile {
  static async read (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })
    return ProfilesPresenter.render(profile)
  }
}

module.exports = Profile