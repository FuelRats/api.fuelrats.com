import { UnprocessableEntityAPIError } from './APIError'
import permissionList from '../files/permissions'

const defaultPermissions = ['users.read.me', 'rats.read.me']

// Permissions that let a holder escalate their own authority or cause broad harm. Representation
// (the x-representing header) must never grant one of these to a caller who does not already hold
// it. Benign permissions (reads, .me-scoped writes, dispatch) are absent here, so the dispatch bot
// can keep representing dispatchers who hold such permissions.
const escalationSensitivePermissions = new Set([
  'groups.write',
  'users.write',
  'users.read',
  'clients.write',
  'resources.forcedelete',
  'nicknames.write',
])

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
   * Apply the x-representing privilege ceiling. Starting from the permissions the represented
   * identity would grant, drop any escalation-sensitive permission the caller does not already
   * hold, so representation can change identity but never raise the caller's authority. Every
   * non-sensitive permission, and any sensitive permission the caller already holds, passes
   * through unchanged.
   * @param {object} arg function arguments object
   * @param {string[]} arg.callerPermissions permissions the caller holds in its own right
   * @param {string[]} arg.representedPermissions permissions computed for the represented identity
   * @returns {string[]} the permissions the connection may use while representing
   */
  static applyRepresentationCeiling ({ callerPermissions, representedPermissions }) {
    const caller = new Set(callerPermissions)
    return representedPermissions.filter((permission) => {
      return escalationSensitivePermissions.has(permission) === false || caller.has(permission)
    })
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
