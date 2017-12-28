

import i18next from 'i18next'
import localisationResources from '../../localisations.json'
import { Group, User } from './db'
import { ForbiddenAPIError } from './APIError'

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

let groups = {}

/**
 * Fetches all the permissions from the database
 * @returns {Promise.<void>}
 */
async function fetchPermissions () {
  groups = await Group.findAll({})
  groups.sort((group1, group2) => {
    return group1.priority > group2.priority
  })
}

fetchPermissions()


/**
 * Class for managing user permissions
 */
class Permission {
  /**
   * Promise to validate whether a user has the appropriate permissions
   * @param {string[]} permissions - The permissions to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} scope - Optional scope array of an oauth2 client to validate
   * @returns {boolean}
   */
  static require (permissions, user, scope = null) {
    if (Permission.granted(permissions, user, scope)) {
      return true
    }
    throw new ForbiddenAPIError({})
  }

  /**
   * Express.js middleware to require a permission or throw back an error
   * @param {string[]} permissions - The permissions to require
   * @returns {Function} Express.js middleware function
   */
  static required (permissions) {
    return function (ctx, next) {
      if (Permission.granted(permissions, ctx.state.user, ctx.state.scope)) {
        return next()
      } else {
        throw new ForbiddenAPIError({})
      }
    }
  }

  /**
   * Check whether a user has the required permissions
   * @param {string[]} permissions - The permissions to validate
   * @param {Object} origUser - The user object of the user to validate
   * @param {Object} scope - Optional oauth2 client object to validate
   * @returns {boolean} - Boolean value indicating whether permission is granted
   */
  static granted (permissions, origUser, scope = null) {
    if (!origUser || User.isSuspended(origUser) || User.isConfirmed(origUser)) {
      return false
    }

    let user = {}
    Object.assign(user, origUser)

    let hasPermission = false

    for (let permission of permissions) {
      for (let groupRelation of user.data.relationships.groups.data) {
        let group = groups.find((group) => {
          return group.id === groupRelation.id
        })

        if (group && group.permissions.includes(permission)) {
          if (scope) {
            if (scope.includes(permission) || scope.includes('*')) {
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

  /**
   * Returns whether a given user is an administrator
   * @param user The user to check
   * @returns {boolean} Whether the user is an administrator
   */
  static isAdmin (user) {
    return user.included.some((include => {
      if (include.type === 'groups') {
        return include.attributes.isAdministrator
      }
      return false
    }))
  }

  /**
   * Get the available permissions/oauth scopes
   * @returns {Object}
   */
  static get groups () {
    return groups
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
      scopes = Permission.allPermissions
    }

    for (let permission of scopes) {
      let permissionComponents = permission.split('.')
      let [group, action, isSelf] = permissionComponents

      let permissionLocaleKey = permissionLocaleKeys[action]
      permissionLocaleKey += isSelf ? 'Own' : 'All'
      let accessible = Permission.granted([permission], user, null)
      if (isSelf && scopes.includes(`${group}.${action}`)) {
        continue
      }

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

  static get allPermissions () {
    return [
      'rescue.read',
      'rescue.write',
      'rescue.delete',
      'rescue.read.me',
      'rescue.write.me',
      'rescue.delete.me',
      'rat.read',
      'rat.write',
      'rat.delete',
      'rat.read.me',
      'rat.write.me',
      'rat.delete.me',
      'user.read',
      'user.write',
      'user.delete',
      'user.read.me',
      'user.write.me',
      'user.delete.me',
      'client.read',
      'client.write',
      'client.delete',
      'client.read.me',
      'client.write.me',
      'client.delete.me',
      'ship.read',
      'ship.write',
      'ship.delete',
      'ship.read.me',
      'ship.write.me',
      'ship.delete.me',
      'decal.read',
      'decal.read.me'
    ]
  }
}

module.exports = Permission
