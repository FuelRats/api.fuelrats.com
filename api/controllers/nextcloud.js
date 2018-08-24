'use strict'
const { User } = require('../db')
const config = require('../../config')
const { UsersPresenter } = require('../classes/Presenters')

class NextCloudProfile {
  static async read (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })

    let userResponse = UsersPresenter.render(profile, {})
    let displayRat = User.preferredRat(userResponse)

    return {
      identifier: profile.id,
      id: profile.id,
      displayName: displayRat.attributes.name,
      photoURL: `${config.externalUrl}/users/image/${profile.id}`,
    }
  }
}

module.exports = NextCloudProfile
