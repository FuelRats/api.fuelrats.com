'use strict'

const Errors = require('./errors')
const i18next = require('i18next')
const localisationResources = require('../localisations.json')

i18next.init({
  lng: 'en',
  resources:  localisationResources,
})

const permissionLocaleKeys = {
  'read': 'permissionRead',
  'write': 'permissionWrite',
  'delete': 'permissionDelete',
  'groups': 'permissionGroup'
}


/**
 * List of possible permissions and oauth scopes
 * @type {string[]}
 */
const permissions = [
  'rescue.read',
  'rescue.read.me',
  'rescue.write',
  'rescue.write.me',
  'rescue.delete',
  'rat.read',
  'rat.read.me',
  'rat.write',
  'rat.write.me',
  'rat.delete',
  'client.read',
  'client.read.me',
  'client.write',
  'client.write.me',
  'client.delete',
  'client.delete.me',
  'user.read',
  'user.read.me',
  'user.groups',
  'user.delete'

]

/**
 * The permissions available to various user groups
 * @type {{default: string[], overseer: string[], moderator: string[], admin: string[]}}
 */
const groups = {
  default: [
    'rescue.read',
    'rescue.read.me',
    'rescue.write.me',
    'rat.read',
    'rat.write.me',
    'client.read.me',
    'client.write.me',
    'client.delete.me',
    'user.read.me',
    'user.write.me'
  ],

  rat: [],

  dispatch: [],

  overseer: [
    'rescue.write',
    'rat.write',
    'rescue.delete'
  ],

  moderator: [
    'rescue.write',
    'rat.write',
    'user.read',
    'user.write',
    'client.read',
    'rescue.delete'
  ],

  admin: [
    'user.read',
    'rescue.read',
    'rescue.write',
    'rescue.delete',
    'rat.read',
    'rat.write',
    'rat.delete',
    'user.read',
    'user.write',
    'user.delete',
    'user.groups',
    'client.read',
    'client.write',
    'client.delete'
  ]
}

/**
 * Class for managing user permissions
 */
class Permission {
  /**
   * Promise to validate whether a user has the appropriate permissions
   * @param {string[]} permissions - The permissions to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} client - Optional scope array of an oauth2 client to validate
   * @returns {Promise}
   */
  static require (permissions, user, scope = null) {
    if (Permission.granted(permissions, user, scope)) {
      return true
    }
    throw(Permission.permissionError(permissions))
  }

  /**
   * Express.js middleware to require a permission or throw back an error
   * @param {string[]} permission - The permissions to require
   * @returns {Function} Express.js middleware function
   */
  static required (permissions) {
    return function (req, res, next) {
      if (Permission.granted(permissions, req.user, req.scope)) {
        return next()
      } else {
        let error = Permission.permissionError(permissions)
        res.model.errors.push(error)
        res.status(error.code)
        return next(error)
      }
    }
  }

  /**
   * Check whether a user has the required permissions
   * @param {string[]} permissions - The permissions to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} [client] - Optional oauth2 client object to validate if the user has given this application the permission to do this
   * @returns {boolean} - Boolean value indicating whether permission is granted
   */
  static granted (permissions, user, scope = null) {
    if (!user) {
      return false
    }

    let hasPermission = false

    user.groups.push('default')

    for (let permission of permissions) {
      for (let group of user.groups) {
        if (groups[group].includes(permission)) {
          if (scope) {
            if (scope.includes(permission)) {
              hasPermission = true
              break
            }
          } else {
            hasPermission = true
            break
          }
        }
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

  static permissionError (permissions) {
    return Errors.throw('no_permission', permissions)
  }

  /**
   * Get the available permissions/oauth scopes
   * @returns {string[]}
   */
  static get permissions () {
    return permissions
  }

  /**
   * Get a list of localised human readable permissions from a list of OAuth scopes
   * @param {Array} scopes Array of OAuth scopes
   * @param {Object} user A user object to check permissions against
   * @returns {Array} Array of objects with localised human readable permissions
   */
  static humanReadable (scopes, user)  {
    let humanReadablePermissions = []

    if (scopes.includes('*')) {
      scopes = permissions
    }

    for (let permission of scopes) {
      let permissionComponents = permission.split('.')
      let group = permissionComponents[0]
      let action = permissionComponents[1]
      let isSelf = (permissionComponents[2] === 'me')

      let permissionLocaleKey = permissionLocaleKeys[action]
      permissionLocaleKey += isSelf ? 'Own' : 'All'
      let accessible = Permission.granted([permission], user, null)

      let count = 0
      if (group === 'user' && isSelf) {
        count = 1
      }

      humanReadablePermissions.push({
        permission: i18next.t(permissionLocaleKey, {
          group: i18next.t(group, { count: count }),
          count: count
        }),

        accessible: accessible
      })
    }

    return humanReadablePermissions
  }
}

module.exports = Permission
