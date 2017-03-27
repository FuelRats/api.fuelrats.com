'use strict'

let _ = require('underscore')
let Rat = require('../db').Rat

let Errors = require('../errors')
let Permission = require('../permission')
let API = require('../classes/API')

class Controller {
  static read (query) {
    return new Promise(function (resolve, reject) {
      let dbQuery = API.createQueryFromRequest(query)

      Rat.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: dbQuery.limit,
          offset: dbQuery.offset,
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

  static autocomplete (query, connection) {
    return new Promise(function (resolve, reject) {
      let limit = parseInt(query.limit) || 25

      let offset = (parseInt(query.page) - 1) * limit || parseInt(query.offset) || 0

      let dbQuery = {
        where: {
          CMDRname: {
            $iLike: query.name + '%'
          }
        },
        attributes: [
          'id',
          'CMDRname'
        ],
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
      Rat.create(query).then(function (ratInstance) {
        ratInstance.setUser(connection.user.id).then(function () {
          let rat = convertRatToAPIResult(ratInstance)

          let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
            return cl.clientId !== connection.clientId
          })
          connection.websocket.broadcast(allClientsExcludingSelf, {
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
      if (query.id) {
        Rat.findOne({ where: { id: query.id } }).then(function (rat) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getRatPermissionType(rat, connection.user)

          Permission.require(permission, connection.user).then(function () {
            Rat.update(data, {
              where: { id: query.id }
            }).then(function () {
              Rat.findOne({ id: query.id }).then(function (ratInstance) {
                let newRat = convertRatToAPIResult(ratInstance)
                let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                  return cl.clientId !== connection.clientId
                })
                connection.websocket.broadcast(allClientsExcludingSelf, {
                  action: 'rat:updated'
                }, newRat)
                resolve({ data: newRat, meta: {} })
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
        Rat.findById(query.id).then(function (rat) {
          rat.destroy()

          let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
            return cl.clientId !== connection.clientId
          })
          connection.websocket.broadcast(allClientsExcludingSelf, {
            action: 'rat:deleted'
          }, convertRatToAPIResult(rat))

          resolve({ data: null, meta: {} })
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
      Rat.findById(id).then(function (ratInstance) {
        response.model.data = convertRatToAPIResult(ratInstance)
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

function getRatPermissionType (rat, user) {
  return user.CMDRs.indexOf(rat.id) !== -1 ? 'self.rat.update' : 'rat.update'
}

function convertRatToAPIResult (ratInstance) {
  let rat = ratInstance.toJSON()
  delete rat.UserId
  delete rat.deletedAt
  return rat
}

module.exports = { Controller, HTTP }
