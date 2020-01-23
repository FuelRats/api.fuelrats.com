

import i18next from 'i18next'
import { Group } from '../db/index'
import { Context } from '../classes/Context'
import fs from 'fs'

const localisationResources = JSON.parse(fs.readFileSync('localisations.json', 'utf8'))
const permissionList = JSON.parse(fs.readFileSync('permissions.json', 'utf8'))

// noinspection JSIgnoredPromiseFromCall
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
   * Check whether a user has the required permissions
   * @param {object} arg function arguments object
   * @param {string[]} arg.permissions - The permissions to validate
   * @param {Context} arg.connection request context
   * @returns {boolean} - Boolean value indicating whether permission is granted
   */
  static granted ({ permissions, connection }) {
    if (!connection.state.user || connection.state.user.isDeactivated() || connection.state.user.isSuspended()) {
      return false
    }

    return permissions.some((permission) => {
      return connection.state.permissions.includes(permission)
    })
  }

  /**
   * Get all permissions available to the user on this connection
   * @param {Context} connection request context
   * @returns {[string]} permissions
   */
  static getConnectionPermissions ({ connection }) {
    const { user, scope: scopes } = connection.state
    if (!user || !user.groups) {
      return []
    }


    let permissions = user.groups.reduce((accumulator, value) => {
      return accumulator.concat(value.permissions)
    }, [])

    if (scopes) {
      permissions = permissions.filter((permission) => {
        return scopes.includes(permission) || scopes.includes('*')
      })
    }
    return permissions
  }

  /**
   * Get the available permissions/oauth scopes
   * @returns {object}
   */
  static get groups () {
    return groups
  }

  /**
   * Get a list of localised human readable permissions from a list of OAuth scopes
   * @param {object} arg function arguments object
   * @param {Array} arg.scopes Array of OAuth scopes
   * @param {Context} arg.connection request context
   * @returns {Array} Array of objects with localised human readable permissions
   */
  static humanReadable ({ scopes, connection })  {
    let scopeList = scopes
    if (scopeList.includes('*')) {
      scopeList = Permission.allPermissions
    }

    return scopeList.reduce((acc, permission) => {
      const permissionComponents = permission.split('.')
      const [group, action, isSelf] = permissionComponents

      let permissionLocaleKey = permissionLocaleKeys[action]
      permissionLocaleKey += isSelf ? 'Own' : 'All'
      const accessible = Permission.granted({ permissions: [permission], connection })
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
        accessTypeList = ['read', 'write']
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
