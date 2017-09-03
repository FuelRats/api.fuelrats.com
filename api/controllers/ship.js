'use strict'

const _ = require('underscore')
const Ship = require('../db').Ship
const ShipQuery = require('../Query/ShipQuery')
const ShipsPresenter = require('../classes/Presenters').ShipsPresenter

const Errors = require('../errors')
const Permission = require('../permission')

class Ships {
  static async search (ctx) {
    let shipsQuery = new ShipQuery(ctx.query, ctx)
    let result = await Ship.findAndCountAll(shipsQuery.toSequelize)
    return ShipsPresenter.render(result.rows, ctx.meta(result, shipsQuery))
  }

  static async findById (ctx) {
    if (ctx.params.id) {
      let shipsQuery = new ShipQuery({id: ctx.params.id}, ctx)
      let result = await Ship.findAndCountAll(shipsQuery.toSequelize)

      return ShipsPresenter.render(result.rows, ctx.meta(result, shipsQuery))
    } else {
      throw Error.template('missing_required_field', 'id')
    }
  }

  static async create (ctx) {
    if (!isSelfRatOrHasPermission(ctx, ctx.data.ratId)) {
      throw Errors.template('no_permission', ['ship.write'])
    }

    let result = await Ship.create(ctx.data)
    if (!result) {
      throw Error.template('operation_failed')
    }

    ctx.response.status = 201
    let renderedResult = ShipsPresenter.render(result, ctx.meta(result))
    process.emit('shipCreated', ctx, renderedResult)
    return renderedResult
  }

  static async update (ctx) {
    let ship = await Ship.findOne({
      where: {
        id: ctx.params.id
      }
    })

    if (!ship) {
      throw Error.template('not_found', ctx.params.id)
    }

    if (!Permission.granted(['rat.write'], ctx.state.user, ctx.state.scope)) {
      delete ctx.data.userId
    }

    let rescue = await Rat.update(ctx.data, {
      where: {
        id: ctx.params.id
      }
    })

    if (!rescue) {
      throw Error.template('operation_failed')
    }

    let ratQuery = new RatQuery({id: ctx.params.id}, ctx)
    let result = await Rat.findAndCountAll(ratQuery.toSequelize)
    let renderedResult = RatsPresenter.render(result.rows, ctx.meta(result, ratQuery))
    process.emit('ratUpdated', ctx, renderedResult)
    return renderedResult
  }
}

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

function isSelfRatOrHasPermission (ctx, ratId) {
  let rat = ctx.state.user.included.find((included) => {
    included.id === ratId
  })

  return rat || Permission.granted(['ship.write'], ctx.state.user, ctx.state.scope)
}

module.exports = Ships
