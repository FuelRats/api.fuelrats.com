'use strict'

const _ = require('underscore')
const Ship = require('../db').Ship
const Rat = require('../db').Rat

const Errors = require('../errors')
const Permission = require('../permission')
const API = require('../classes/API')

class Controller {
  static read (query) {
    return new Promise(function (resolve, reject) {
      let dbQuery = API.createQueryFromRequest(query)

      Ship.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: dbQuery.limit,
          offset: dbQuery.offset,
          total: result.count
        }

        let ships = result.rows.map(function (shipInstance) {
          return convertShipToAPIResult(shipInstance)
        })

        resolve({
          data: ships,
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
      Ship.create(query).then(function (shipInstance) {
        let ship = convertShipToAPIResult(shipInstance)

        let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
          return cl.clientId !== connection.clientId
        })
        connection.websocket.broadcast(allClientsExcludingSelf, {
          action: 'ship:created'
        }, ship)

        resolve({
          data: ship,
          meta: {}
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
      if (query.id) {
        Ship.findOne({ where: { id: query.id } }).then(function (ship) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getShipPermissionType(ship.ratId, connection.user)

          Permission.require(permission, connection.user).then(function () {
            Ship.update(data, {
              where: { id: query.id }
            }).then(function () {
              Ship.findOne({ id: query.id }).then(function (shipInstance) {
                let newShip = convertShipToAPIResult(shipInstance)
                let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                  return cl.clientId !== connection.clientId
                })
                connection.websocket.broadcast(allClientsExcludingSelf, {
                  action: 'ship:updated'
                }, newShip)
                resolve({ data: newShip, meta: {} })
              })
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
      if (query.id) {
        Ship.findById(query.id).then(function (ship) {
          let permission = getShipPermissionType(ship.ratId, connection.user)
          Permission.require(permission, connection.user).then(function () {
            ship.destroy()

            let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
              return cl.clientId !== connection.clientId
            })
            connection.websocket.broadcast(allClientsExcludingSelf, {
              action: 'ship:deleted'
            }, convertShipToAPIResult(ship))

            resolve({ data: null, meta: {} })
          })
        }).catch(function (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
        })
      } else {
        reject({ error: Errors.throw('missing_required_field', 'id'), meta: {} })
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

  static autocomplete (request, response, next) {
    Controller.autocomplete(request.query).then(function (res) {
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

    if (id) {
      Ship.findById(id).then(function (shipInstance) {
        response.model.data = convertShipToAPIResult(shipInstance)
        response.status(200)
        next()
      }).catch(function (error) {
        response.model.errors.push(error)
        response.status(400)
        next()
      })
    } else {
      response.model.errors.push(Errors.throw('missing_required_field', 'id'))
      response.status(400)
      next()
    }
  }

  static post (request, response, next) {
    Controller.create(request.body, request).then(function (res) {
      response.model.data = res.data
      response.status(201)
      next()
    }, function (error) {
      response.model.errors.push(error)
      response.status(error.error.code)
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


function getShipPermissionType (rat, user) {
  return user.CMDRs.indexOf(rat) !== -1 ? 'self.rat.update' : 'rat.update'
}


function convertShipToAPIResult (ratInstance) {
  let rat = ratInstance.toJSON()
  delete rat.deletedAt
  return rat
}

module.exports = { Controller, HTTP }
