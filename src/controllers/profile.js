'use strict'
const { User } = require('../db')
const APIEndpoint = require('../APIEndpoint')
const Rats = require('./rat')
const Groups = require('./group')

class Profiles extends APIEndpoint {
  async read  (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })
    return Profiles.presenter.render(profile)
  }

  static get presenter () {
    class ProfilesPresenter extends APIEndpoint.presenter {
      relationships () {
        return {
          rats: Rats.presenter,
          groups: Groups.presenter,
          displayRat: Rats.presenter
        }
      }
    }
    ProfilesPresenter.prototype.type = 'profiles'
    return ProfilesPresenter
  }
}

module.exports = Profiles