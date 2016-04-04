'use strict'

const permissions = {
  normal: [
    'rescue.create',
    'rat.create'
  ],
  overseer: [
    'rescue.create',
    'rescue.edit',
    'rat.create',
    'rat.edit',
    'drill.*'
  ],
  moderator: [
    'rescue.*',
    'rat.*',
    'drill.*'
  ],
  admin: [
    '*'
  ]
}

class Permission {
  static require (permission, user) {
    let userLevel = user.group
    let hasPermission = false

    for (let currentPermission of permissions[userLevel]) {
      permission = permission.split('.')
      let currentNodeIndex = 0

      while (currentNodeIndex < permission.length) {
        if (permission[currentNodeIndex] === '*') {
          currentNodeIndex = (permission.length - 1)
        }
        if (permission[currentNodeIndex] !== currentPermission[currentNodeIndex]) {
          break
        }

        currentNodeIndex += 1
      }

      if (currentNodeIndex === (permission.length - 1)) {
        hasPermission = true
        break
      }
    }
    return hasPermission
  }
}

exports = Permission
