'use strict'
const { User } = require('../../db')
const { UsersPresenter } = require('../../classes/Presenters')

class JiraProfile {
  static async read (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })

    let userResponse = UsersPresenter.render(profile, {})
    let displayRat = User.preferredRat(userResponse)

    return {
      id: profile.id,
      email: profile.email,
      username: displayRat.attributes.name,
      name: displayRat.attributes.name
    }
  }
}

module.exports = JiraProfile
