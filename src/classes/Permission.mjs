import { UnprocessableEntityAPIError } from './APIError'
import { Context } from './Context'
import permissionList from '../files/permissions'

const defaultPermissions = ['users.read.me', 'rats.read.me']

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


    let permissions = defaultPermissions.concat(user.groups.reduce((accumulator, value) => {
      return accumulator.concat(value.permissions)
    }, []))

    if (scopes) {
      permissions = permissions.filter((permission) => {
        return scopes.includes(permission) || scopes.includes('*')
      })
    }
    return permissions
  }

  /**
   * Check whether a permission/scope is valid
   * @param {string} scope a permission/scope
   * @returns {boolean}
   */
  static isValidOAuthScope (scope) {
    const openidScopes = ['openid', 'profile', 'email', 'groups']
    return scope === '*' || Permission.allPermissions.includes(scope) || openidScopes.includes(scope)
  }

  /**
   * Throw an exception if one of the scopes in the list are not a valid permission
   * @param {[string]} scopes list of permissions/scopes
   * @throws UnprocessableEntityAPIError
   */
  static assertOAuthScopes (scopes) {
    const allScopesValid = scopes.every((scope) => {
      return Permission.isValidOAuthScope(scope)
    })
    if (allScopesValid === false) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/scope' })
    }
  }

  /**
   * Get all existing permissions available in the API
   * @returns {[string, any]} All existing permissions
   */
  static get allPermissions () {
    return Object.entries(permissionList).reduce((acc, [domain, accessTypes]) => {
      acc.push(...accessTypes.map((accessType) => {
        return `${domain}.${accessType}`
      }))

      return acc
    }, [])
  }
}
