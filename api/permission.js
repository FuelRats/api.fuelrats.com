'use strict'

let Errors = require('./errors')

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
  'user.groups.me',
  'user.delete'

]

/**
 * The permissions available to various user groups
 * @type {{default: string[], overseer: string[], moderator: string[], admin: string[]}}
 */
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

/**
 * Class for managing various permissions
 */
class Permission {
  /**
   * Promise to validate whether a user has the appropriate permissions
   * @param {string} permission - The permission to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} client - Optional client object of an oauth2 client to validate
   * @returns {Promise}
   */
  static require (permission, user, client = null) {
    return new Promise(function (resolve, reject) {
      if (Permission.granted(permission, user, client)) {
        resolve()
      } else {
        let error = Permission.permissionError(permission)
        reject(error)
      }
    })
  }

  /**
   * Express.js middleware to require a permission or throw back an error
   * @param {string} permission - The permission to require
   * @returns {Function} Express.js middleware function
   */
  static required (permission) {
    return function (req, res, next) {
      if (Permission.granted(permission, req.user, req.client)) {
        return next()
      } else {
        let error = Permission.permissionError(permission)
        res.model.errors.push(error)
        res.status(error.code)
        return next()
      }
    }
  }

  /**
   * Check whether a user has the required permissions
   * @param {string} permission - The permission to validate
   * @param {Object} user - The user object of the user to validate
   * @param {Object} [client] - Optional oauth2 client object to validate if the user has given this application the permission to do this
   * @returns {boolean} - Boolean value indicating whether permission is granted
   */
  static granted (permission, user, client = null) {
    let hasPermission = false

    for (let group of user.groups) {
      if (groups[group].includes(permission)) {
        if (client) {
          if (client.scopes.includes(permission)) {
            hasPermission = true
            break
          }
        } else {
          hasPermission = true
          break
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

  static permissionError (permission) {
    return Errors.throw('no_permission', permission)
  }

  /**
   * Get the available permissions/oauth scopes
   * @returns {string[]}
   */
  static get permissions () {
    return permissions
  }
}

module.exports = Permission
