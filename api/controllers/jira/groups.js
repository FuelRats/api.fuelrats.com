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
      role: ['recruit', ...profile.groups.map((group) => {
        return group.id
      })]
    }
  }
}

/**
 * Get highest priority role from a profile
 * @param profile
 */
function getRole (profile) {
  let roles = profile.groups.sort((previousValue, currentValue) => {
    return currentValue.priority > previousValue.priority
  })

  if (roles.length > 0) {
    return roles[0].id
  }
  return 'recruit'
}

module.exports = JiraGroups
