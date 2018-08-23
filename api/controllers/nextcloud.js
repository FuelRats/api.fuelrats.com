'use strict'
const { User } = require('../db')

class NextCloudProfile {
  static async read (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })
    let profileJson = profile.toJSON()
    profileJson.identifier = profileJson.email
    return profileJson
  }
}

module.exports = NextProfile
