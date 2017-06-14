'use strict'

const _ = require('underscore')
const db = require('../db').db
const Rat = require('../db').Rat
const Rescue = require('../db').Rescue
const Epic = require('../db').Epic
const API = require('../classes/API')
const RescueQuery = require('../Query/RescueQuery')
const RescueResult = require('../Results/rescue')

const Errors = require('../errors')
const Permission = require('../permission')
const BotServ = require('../Anope/BotServ')
const Statistics = require('../classes/Statistics')

class Rescues {
  static search (params, connection) {
    return new Promise(function (resolve, reject) {
      Rescue.findAndCountAll(new RescueQuery(params, connection).toSequelize).then(function (result) {
        resolve(new RescueResult(result, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static findById (params, connection) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize).then(function (result) {
          resolve(new RescueResult(result, params).toResponse())
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
      Rescue.create(data).then(function (rescue) {
        if (!rescue) {
          return reject(Errors.throw('operation_failed'))
        }
        resolve(new RescueResult(rescue, params).toResponse())
      }).catch(function (error) {
        reject(Errors.throw('server_error', error.message))
      })
    })
  }

  static update (params, connection, data) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rescue.findOne({
          where: {
            id: params.id
          }
        }).then(function (rescue) {
          if (!rescue) {
            reject(Error.throw('not_found', params.id))
          }

          let permission = getRescuePermissionType(rescue, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            Rescue.update(data, {
              where: {
                id: params.id
              }
            }).then(function (rescue) {
              if (!rescue) {
                return reject(Error.throw('operation_failed'))
              }

              Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize).then(function (result) {
                resolve(new RescueResult(result, params).toResponse())
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
        Rescue.findOne({
          where: {
            id: params.id
          }
        }).then(function (rescue) {
          if (!rescue) {
            return reject(Error.throw('not_found', params.id))
          }

          rescue.destroy()

          resolve(null)
        }).catch(function (err) {
          reject({ error: Errors.throw('server_error', err), meta: {} })
        })
      }
    })
  }

  static assign (params, connection, data) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rescue.findOne({
          where: {
            id: params.id
          }
        }).then(function (rescue) {
          if (!rescue) {
            reject(Error.throw('not_found', params.id))
          }

          let permission = getRescuePermissionType(rescue, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            let rats = []
            for (let rat of data) {
              rats.push(rescue.addRat(rat))
            }

            Promise.all(rats).then(function () {
              Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize).then(function (result) {
                resolve(new RescueResult(result, params).toResponse())
              }).catch(function (errors) {
                reject(Errors.throw('server_error', errors[0].message))
              })
            }).catch(function (err) {
              reject(Error.throw('server_error', err))
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

  static unassign (params, connection, data) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rescue.findOne({
          where: {
            id: params.id
          }
        }).then(function (rescue) {
          if (!rescue) {
            reject(Error.throw('not_found', params.id))
          }

          let permission = getRescuePermissionType(rescue, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            let rats = []
            for (let rat of data) {
              rats.push(rescue.removeRat(rat))
            }

            Promise.all(rats).then(function () {
              Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize).then(function (result) {
                resolve(new RescueResult(result, params).toResponse())
              }).catch(function (errors) {
                reject(Errors.throw('server_error', errors[0].message))
              })
            }).catch(function (err) {
              reject(Error.throw('server_error', err))
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

  static addquote (params, connection, data) {
    return new Promise(function (resolve, reject) {
      if (params.id) {
        Rescue.findOne({
          where: {
            id: params.id
          }
        }).then(function (rescue) {
          if (!rescue) {
            reject(Error.throw('not_found', params.id))
          }

          let permission = getRescuePermissionType(rescue, connection.user)
          Permission.require(permission, connection.user, connection.scope).then(function () {
            Rescue.update({
              quotes: rescue.quotes.concat(data)
            }, {
              where: {
                id: params.id
              }
            }).then(function () {
              Rescue.findAndCountAll(new RescueQuery({ id: params.id }, connection).toSequelize).then(function (result) {
                resolve(new RescueResult(result, params).toResponse())
              }).catch(function (errors) {
                reject(Errors.throw('server_error', errors[0].message))
              })
            }).catch(function (err) {
              reject(Error.throw('server_error', err))
            })
          }).then(function (err) {
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
}

module.exports = Rescues