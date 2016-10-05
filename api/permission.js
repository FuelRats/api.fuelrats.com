'use strict'

let Errors = require('./errors')

const groups = {
  default: [
    'rescue.read',
    'rescue.write.me',
    'rat.read',
    'rat.write.me',
    'client.read.me',
    'client.write.me',
    'client.delete.me',
    'user.read.me',
    'user.write.me'
  ],

  overseer: [
    'rescue.write',
    'rat.write',
    'user.read',
    'user.groups',
    'rescue.delete'
  ],

  moderator: [
    'rescue.write',
    'rat.write',
    'user.read',
    'user.write',
    'user.groups',
    'client.read',
    'rescue.delete'
  ],

  admin: [
    'rescue.write',
    'rescue.delete',
    'rat.write',
    'rat.delete',
    'user.write',
    'user.delete',
    'user.groups',
    'client.write',
    'client.delete'
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

  static required (permission, isUserFacing) {
    return function (req, res, next) {
      if (Permission.granted(permission, req.user)) {
        return next()
      } else {
        let error = Permission.permissionError(permission)
        res.model.errors.push(error)
        res.status(error.code)
        res.isUserFacing = isUserFacing
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
    if (permission) {
      return Errors.throw('not_authenticated', permission)
    } else {
      return Errors.throw('not_authenticated')
    }
  }

  static permissionError (permission) {
    return Errors.throw('no_permission', permission)
  }
}

module.exports = Permission
