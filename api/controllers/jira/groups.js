'use strict'
const { User } = require('../../db')

class JiraGroups {
  static async read (ctx) {
    let profile = await User.scope('defaultScope', 'profile').findOne({
      where: {
        id: ctx.state.user.data.id
      }
    })

    return {
      id: profile.id,
      groups: profile.groups.map((group) => {
        return group.id
      })
    }
  }
}

module.exports = JiraGroups
