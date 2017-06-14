'use strict'

const Rat = require('../db').Rat

const Errors = require('../errors')
const Permission = require('../permission')
const RatQuery = require('../Query/RatQuery')
const RatResult = require('../Results/rat')

class Rats {
  static search (params, connection) {
    return new Promise(function (resolve, reject) {
      Rat.findAndCountAll(new RatQuery(params, connection).toSequelize).then(function (result) {
        resolve(new RatResult(result, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static findById (params, connection) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rat.findAndCountAll(new RatQuery({ id: params.id }, connection).toSequelize).then(function (result) {
          resolve(new RatResult(result, params).toResponse())
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
      Rat.create(data).then(function (rat) {
        if (!rat) {
          return reject(Errors.throw('operation_failed'))
        }

        resolve(new RatResult(rat, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static update (params, connection, data) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rat.findOne({
          where: {
            id: params.id
          }
        }).then(function (rat) {
          if (!rat) {
            reject(Error.throw('not_found', params.id))
          }

          let permission = getRatPermissionType(rat, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            Rat.update(data, {
              where: {
                id: params.id
              }
            }).then(function (rat) {
              if (!rat) {
                return reject(Error.throw('operation_failed'))
              }

              Rat.findAndCountAll(new RatQuery({ id: params.id }, connection).toSequelize).then(function (result) {
                resolve(new RatResult(result, params).toResponse())
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
        Rat.findOne({
          where: {
            id: params.id
          }
        }).then(function (rat) {
          if (!rat) {
            return reject(Error.throw('not_found', params.id))
          }

          rat.destroy()

          resolve(null)
        }).catch(function (err) {
          reject({ error: Errors.throw('server_error', err), meta: {} })
        })
      }
    })
  }
}

const selfWriteAllowedPermissions = ['rat.write.me', 'rat.write']

function getRatPermissionType (rat, user) {
  if (user === rat.userId) {
    return selfWriteAllowedPermissions
  }
  return ['rescue.write']
}

module.exports = Rats
