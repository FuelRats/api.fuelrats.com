'use strict'

const Errors = require('./errors')
const i18next = require('i18next')
const localisationResources = require('../localisations.json')
const Group = require('./db').Group

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

async function fetchPermissions () {
  groups = await Group.findAll({})
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
   * @returns {Promise}
   */
  static require (permissions, user, scope = null) {
    if (Permission.granted(permissions, user, scope)) {
      return true
    }
    throw Permission.permissionError(permissions)
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
        throw Permission.permissionError(permissions)
      }
    }
  }

  /**
   * Check whether a user has the required permissions
   * @param {string[]} permissions - The permissions to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} scope - Optional oauth2 client object to validate
   * @returns {boolean} - Boolean value indicating whether permission is granted
   */
  static granted (permissions, user, scope = null) {
    if (!user) {
      return false
    }

    let hasPermission = false

    user.data.relationships.groups.data.push({
      id: 'default',
      type: 'groups'
    })

    for (let permission of permissions) {
      for (let groupRelation of user.data.relationships.groups.data) {
        let group = groups.find((group) => {
          return group.id === groupRelation.id
        })

        if (group && group.permissions.includes(permission.id)) {
          if (scope) {
            if (scope.includes(permission.id) || scope.includes('*')) {
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
      return Errors.template('not_authenticated', permission)
    } else {
      return Errors.template('not_authenticated')
    }
  }

  static permissionError (permissions) {
    return Errors.template('no_permission', permissions)
  }

  /**
   * Get the available permissions/oauth scopes
   * @returns {string[]}
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
      scopes = groups
    }

    for (let permission of scopes) {
      let permissionComponents = permission.split('.')
      let group = permissionComponents[0]
      let action = permissionComponents[1]
      let isSelf = (permissionComponents[2] === 'me')

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
}

module.exports = Permission
