'use strict'

let _ = require('underscore')
let Rat = require('../db').Rat

let Errors = require('../errors')
let websocket = require('../websocket')
let Permission = require('../permission')

class Controller {
  static read (query) {
    return new Promise(function (resolve, reject) {
      let limit = parseInt(query.limit) || 25
      delete query.limit

      let offset = parseInt(query.offset) || 0
      delete query.offset

      let dbQuery = {
        where: query,
        limit: limit,
        offset: offset
      }

      Rat.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: limit,
          offset: offset,
          total: result.count
        }

        let rats = result.rows.map(function (ratInstance) {
          let rat = convertRatToAPIResult(ratInstance)
          return rat
        })

        resolve({
          data: rats,
          meta: meta
        })
      }).catch(function (error) {
        let errorObj = Errors.server_error
        errorObj.detail = error
        reject({
          error: errorObj,
          meta: {}
        })
      })
    })
  }

  static create (query, connection) {
    return new Promise(function (resolve, reject) {
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('self.rat.create')
        reject({ error: error, meta: {} })
        return
      }

      Rat.create(query).then(function (ratInstance) {
        ratInstance.setUser(connection.user.id).then(function () {
          let rat = convertRatToAPIResult(ratInstance)

          let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
            return cl.clientId !== connection.clientId
          })
          websocket.broadcast(allClientsExcludingSelf, {
            action: 'rat:created'
          }, rat)

          resolve({
            data: rat,
            meta: {}
          })
        }).catch(function (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
        })
      }).catch(function (error) {
        let errorModel = Errors.server_error
        errorModel.detail = error
        reject({
          error: errorModel,
          meta: {}
        })
      })
    })
  }

  static update (data, connection, query) {
    return new Promise(function (resolve, reject) {
      // Modifying a rescue requires an authenticated user
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('self.rat.update')
        reject({ error: error, meta: {} })
        return
      }

      if (query.id) {
        Rat.findOne({ id: query.id }).then(function (rat) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getRatPermissionType(rat, connection.user)

          Permission.require(permission, connection.user).then(function () {
            Rat.update(data, {
              where: { id: rat.id }
            }).then(function (ratInstance) {
              let rat = convertRatToAPIResult(ratInstance)

              let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
                return cl.clientId !== connection.clientId
              })
              websocket.broadcast(allClientsExcludingSelf, {
                action: 'rat:updated'
              }, rat)
              resolve({ data: rat, meta: {} })
            }).catch(function (error) {
              reject({ error: Errors.throw('server_error', error), meta: {} })
            })
          }, function (error) {
            reject({ error: error })
          })
        }, function (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
        })
      } else {
        reject({ error: Errors.throw('missing_required_field', 'id'), meta: {} })
      }
    })
  }

  static delete (data, connection, query) {
    return new Promise(function (resolve, reject) {
      // Modifying a rescue requires an authenticated user
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('rat.delete')
        reject({ error: error, meta: {} })
        return
      }

      if (query.id) {
        Permission.require('rat.delete', connection.user).then(function () {
          Rat.findById(query.id).then(function (rat) {
            rat.destroy()
            resolve({ data: null, meta: {} })
          }).catch(function (error) {
            reject({ error: Errors.throw('server_error', error), meta: {} })
          })
        }).catch(function (error) {
          reject({ error: error })
        })
      } else {
        reject({ error: Errors.throw('bad_request', 'Missing rescue id'), meta: {} })
      }
    })
  }
}

class HTTP {
  static get (request, response, next) {
    Controller.read(request.query).then(function (res) {
      let data = res.data
      let meta = res.meta

      response.model.data = data
      response.model.meta = meta
      response.status = 400
      next()
    }).catch(function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static getById (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
    let id = request.params.id

    Rat.findById(id).then(function (ratInstance) {
      response.model.data = convertRatToAPIResult(ratInstance)
      response.status(200)
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(400)
      next()
    })
  }

  static post (request, response, next) {
    Controller.create(request.body, {}).then(function (res) {
      response.model.data = res.data
      response.status(201)
      next()
    }, function (error) {
      response.model.errors.push(error)
      response.status(400)
      next()
    })
  }

  static put (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.update(request.body, request, request.params).then(function (data) {
      response.model.data = data.data
      response.status(201)
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(error.error.code)
      next()
    })
  }

  static delete (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.delete(request.body, request, request.params).then(function () {
      response.status(204)
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(error.error.code)
      next()
    })
  }
}

function getRatPermissionType (rat, user) {
  return user.CMDRs.indexOf(rat.id) !== -1 ? 'self.rat.update' : 'rat.update'
}

function convertRatToAPIResult (ratInstance) {
  let rat = ratInstance.toJSON()
  delete rat.UserId
  return rat
}

module.exports = { Controller, HTTP }
