'use strict'

let ErrorModels = require('./errors')

const permissions = {
  normal: [
    'rescue.create',
    'rat.*.self',
    'client.*.self'
  ],
  overseer: [
    'client.*.self',
    'rescue.create',
    'rescue.update',
    'rat.update',
    'rat.update',
    'drill.*'
  ],
  moderator: [
    'client.*.self',
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
    return new Promise(function (resolve, reject) {
      if (Permission.granted(permission, user)) {
        resolve()
      } else {
        let error = Permission.permissionError(permission)
        reject(error)
      }
    })
  }

  static granted (permission, user) {
    let userLevel = user.group
    let hasPermission = false
    permission = permission.split('.')

    for (let currentPermission of permissions[userLevel]) {
      console.log(currentPermission, permission)
      currentPermission = currentPermission.split('.')
      let currentNodeIndex = 0

      while (currentNodeIndex < permission.length) {
        if (currentPermission[currentNodeIndex] === '*') {
          console.log(currentNodeIndex, currentPermission.length, permission.length)
          if (currentNodeIndex === currentPermission.length) {
            console.log('currentpermissionlength')
            currentNodeIndex = permission.length
          } else if (currentNodeIndex !== permission.length - 1) {
            currentNodeIndex += 1
            continue
          }
        }
        if (permission[currentNodeIndex] !== currentPermission[currentNodeIndex]) {
          break
        }

        currentNodeIndex += 1
      }

      if (currentNodeIndex === permission.length) {
        hasPermission = true
        break
      }
    }
    return hasPermission
  }

  static authenticationError (permission) {
    let error = ErrorModels.not_authenticated
    error.detail = permission
    return error
  }

  static permissionError (permission) {
    let error = ErrorModels.no_permission
    error.detail = permission
    return error
  }
}

module.exports = Permission
