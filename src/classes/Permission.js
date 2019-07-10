

import i18next from 'i18next'
import localisationResources from '../../localisations.json'
import { Group } from '../db/index'
import { ForbiddenAPIError } from './APIError'

const permissionList = require('../../permissions')

i18next.init({
  lng: 'en',
  resources:  localisationResources
})

const permissionLocaleKeys = {
  'read': 'permissionRead',
  'write': 'permissionWrite',
  'delete': 'permissionDelete'
}

let groups = {}

/**
 * Fetches all the permissions from the database
 * @returns {Promise.<void>}
 */
;(async function fetchPermissions () {
  groups = await Group.findAll({})
  groups.sort((group1, group2) => {
    return group1.priority > group2.priority
  })
})()



/**
 * Class for managing user permissions
 */
export default class Permission {
  /**
   * Promise to validate whether a user has the appropriate permissions
   * @param {string[]} permissions - The permissions to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} scope - Optional scope array of an oauth2 client to validate
   * @returns {boolean}
   */
  static require ({ permissions, user, scope = undefined }) {
    if (Permission.granted({ permissions, user, scope })) {
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
      if (Permission.granted({ permissions, origUser: ctx.state.user, scope: ctx.state.scope })) {
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
  static granted ({ permissions, user: origUser, scope = undefined }) {
    if (!origUser || origUser.isDeactivated()) {
      return false
    } else if (origUser.isDeactivated() || origUser.isSuspended()) {
      return false
    }

    const user = {}
    Object.assign(user, origUser)

    let hasPermission = false

    for (const permission of permissions) {
      for (const groupRelation of user.groups) {
        const group = groups.find((groupItem) => {
          return groupItem.id === groupRelation.id
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

  static getConnectionPermissions ({ connection }) {
    const { user, scope: scopes } = connection.state
    if (!user || !user.groups) {
      return undefined
    }

    let permissions = user.groups.reduce((accumulator, value) => {
      return accumulator.concat(value.permissions)
    }, [])

    if (scopes) {
      permissions = permissions.filter((permission) => {
        return scopes.includes(permission)
      })
    }
    return permissions
  }

  /**
   * Returns whether a given user is an administrator
   * @param user The user to check
   * @returns {boolean} Whether the user is an administrator
   */
  static isAdmin ({ user }) {
    return user.group.some(((group) => {
      return group.isAdministrator
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
  static humanReadable ({ scopes, user })  {
    let scopeList = scopes
    if (scopeList.includes('*')) {
      scopeList = Permission.allPermissions
    }

    return scopeList.reduce((acc, permission) => {
      const permissionComponents = permission.split('.')
      const [group, action, isSelf] = permissionComponents

      let permissionLocaleKey = permissionLocaleKeys[action]
      permissionLocaleKey += isSelf ? 'Own' : 'All'
      const accessible = Permission.granted({ permissions: [permission], user, scope: undefined })
      if (isSelf && scopeList.includes(`${group}.${action}`)) {
        return acc
      }

      const count = group === 'user' && isSelf ? 1 : 0

      acc.push({
        permission: i18next.t(permissionLocaleKey, {
          group: i18next.t(group, { count }),
          count
        }),
        accessible
      })
      return acc
    }, [])
  }

  /**
   * Get all existing permissions available in the API
   * @returns {[string, any]} All existing permissions
   */
  static get allPermissions () {
    return Object.entries(permissionList).reduce((acc, [domain, [self, ...accessTypes]]) => {
      let accessTypeList = accessTypes
      if (accessTypeList.length === 0) {
        accessTypeList = ['read', 'write', 'delete']
      }

      acc.push(...accessTypeList.map((accessType) => {
        return `${domain}.${accessType}`
      }))

      if (self) {
        acc.push(...accessTypeList.map((accessType) => {
          return `${domain}.${accessType}.me`
        }))
      }

      return acc
    }, [])
  }
}
