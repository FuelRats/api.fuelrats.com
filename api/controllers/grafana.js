'use strict'
const { User } = require('../db')
const config = require('../../config')
const { UsersPresenter } = require('../classes/Presenters')

class GrafanaProfile {
  static async read (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })

    let userResponse = UsersPresenter.render(profile, {})
    let displayRat = User.preferredRat(userResponse)

    const unixUpdateTime = Math.floor(profile.updatedAt.getTime() / 1000)

    return {
      sub: profile.id,
      name: displayRat.attributes.name,
      nickname: displayRat.attributes.name,
      preferred_username: displayRat.attributes.name,
      email: profile.email,
      picture: `${config.externalUrl}/users/image/${profile.id}`,
      profile: 'https://fuelrats.com/profile',
      updated_at: unixUpdateTime
    }
  }
}

module.exports = GrafanaProfile
