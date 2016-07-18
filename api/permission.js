'use strict'

let Errors = require('./errors')

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

  static required (permission) {
    return function (req, res, next) {
      if (Permission.granted(permission, req.user)) {
        return next()
      } else {
        let error = Permission.permissionError(permission)
        res.model.errors.push(error)
        res.status(error.code)
        return next()
      }
    }
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
          hasPermission = true
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
    return Errors.throw('not_authenticated', permission)
  }

  static permissionError (permission) {
    return Errors.throw('no_permission', permission)
  }
}

module.exports = Permission
