'use strict'

let ErrorModels = require('./errors')

const permissions = {
  normal: [
    'rescue.create',
    'rescue.read',
    'self.*'
  ],
  overseer: [
    'self.*',
    'rescue.read',
    'rescue.create',
    'rescue.update',
    'rat.read',
    'rat.update',
    'drill.*',
    'admin.read'
  ],
  moderator: [
    'self.*',
    'admin.read',
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
      currentPermission = currentPermission.split('.')
      let currentNodeIndex = 0

      while (currentNodeIndex < permission.length) {
        if (currentPermission[currentNodeIndex] === '*') {
          if (currentNodeIndex === permission.length - 2) {
            currentNodeIndex = permission.length
            hasPermission = true
          }
        }
        if (permission[currentNodeIndex] !== currentPermission[currentNodeIndex]) {
          break
        }

        currentNodeIndex += 1
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
