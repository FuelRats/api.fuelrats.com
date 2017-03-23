'use strict'

let User = require('../db').User

let Errors = require('../errors')
let Permission = require('../permission')
let UserQuery = require('../Query/UserQuery')
let UserResult = require('../Results/user')

class Users {
  static search (params, connection) {
    return new Promise(function (resolve, reject) {
      User.findAndCountAll(new UserQuery(params, connection).toSequelize).then(function (result) {
        let permission = getUserReadPermissionType(result, connection.user)
        Permission.require(permission, connection.user, connection.scope).then(function () {
          resolve(new UserResult(result, params).toResponse())
        }).catch(function (err) {
          reject(err)
        })
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static findById (params, connection) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        User.findAndCountAll(new UserQuery({ id: params.id }, connection).toSequelize).then(function (result) {
          let permission = getUserReadPermissionType(result, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            resolve(new UserResult(result, params).toResponse())
          }).catch(function (err) {
            reject(err)
          })
        }).catch(function (errors) {
          reject(Errors.throw('server_error', errors[0].message))
        })
      } else {
        reject(Error.throw('missing_required_field', 'id'))
      }
    })
  }

  static create (params, connection, data) {
    return new Promise(function (resolve, reject) {
      User.create(data).then(function (user) {
        if (!user) {
          return reject(Errors.throw('operation_failed'))
        }

        resolve(new UserResult(user, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static update (params, connection, data) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        User.findOne({
          where: {
            id: params.id
          }
        }).then(function (user) {
          if (!user) {
            reject(Error.throw('not_found', params.id))
          }

          let permission = getUserWritePermissionType(user, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            User.update(data, {
              where: {
                id: params.id
              }
            }).then(function (user) {
              if (!user) {
                return reject(Error.throw('operation_failed'))
              }

              User.findAndCountAll(new UserQuery({ id: params.id }, connection).toSequelize).then(function (result) {
                resolve(new UserResult(result, params).toResponse())
              }).catch(function (error) {
                reject(Errors.throw('server_error', error.message))
              })
            })
          }).catch(function (err) {
            reject(err)
          })
        }).catch(function (err) {
          reject(Error.throw('server_error', err))
        })
      } else {
        reject(Error.throw('missing_required_field', 'id'))
      }
    })
  }

  static delete (params) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        User.findOne({
          where: {
            id: params.id
          }
        }).then(function (user) {
          if (!user) {
            return reject(Error.throw('not_found', params.id))
          }

          user.destroy()

          resolve(null)
        }).catch(function (err) {
          reject({ error: Errors.throw('server_error', err), meta: {} })
        })
      }
    })
  }
}

const selfReadAllowedPermissions = ['user.read.me', 'user.read']
const selfWriteAllowedPermissions = ['user.write.me', 'user.write']

function getUserReadPermissionType (user, self) {
  if (user.id === self.id) {
    return selfReadAllowedPermissions
  }
  return ['user.read']
}

function getUserWritePermissionType (user, self) {
  if (user.id === self.id) {
    return selfWriteAllowedPermissions
  }
  return ['user.write']
}

module.exports = Users
