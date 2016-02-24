'use strict'

let _ = require('underscore')
let Rat = require('../models/rat')
let ErrorModels = require('../errors')
let websocket = require('../websocket')

// GET
// =============================================================================
exports.get = function (request, response, next) {
  exports.read(request.body).then(function (res) {
    let data = res.data
    let meta = res.meta

    response.model.data = data
    response.model.meta = meta
    response.status = 400
    next()
  }, function (error) {
    response.model.errors.push(error.error)
    response.status(400)
  })
}

// GET (by ID)
// =============================================================================
exports.getById = function (request, response, next) {
  response.model.meta.params = _.extend(response.model.meta.params, request.params)

  let id = request.params.id

  Rat.findById(id).populate('rescues').exec(function (error, rat) {
    if (error) {
      response.model.errors.push(error)
      response.status(400)

    } else {
      response.model.data = rat
      response.status(200)
    }

    next()
  })
}

exports.read = function (query) {
  return new Promise(function (resolve, reject) {
    let filter = {}
    let dbQuery = {}

    filter.size = parseInt(query.limit) || 25
    delete query.limit

    filter.from = parseInt(query.offset) || 0
    delete query.offset

    for (let key in query) {
      if (key === 'q') {
        dbQuery.query_string = {
          query: query.q
        }
      } else {
        if (!dbQuery.bool) {
          dbQuery.bool = {
            should: []
          }
        }

        let term = {}
        term[key] = {
          query: query[key],
          fuzziness: 'auto'
        }
        dbQuery.bool.should.push({
          match: term
        })
      }
    }

    if (!Object.keys(dbQuery).length) {
      dbQuery.match_all = {}
    }

    Rat.search(dbQuery, filter, function (error, dbData) {
      if (error) {
        let errorObj = ErrorModels.server_error
        errorObj.detail = error
        reject({
          error: errorObj,
          meta: {}
        })

      } else {
        let meta = {
          count: dbData.hits.hits.length,
          limit: filter.size,
          offset: filter.from,
          total: dbData.hits.total
        }
        let data = []

        dbData.hits.hits.forEach(function (rat) {
          rat._source._id = rat._id
          rat._source.score = rat._score

          data.push(rat._source)
        })

        resolve({
          data: data,
          meta: meta
        })
      }
    })
  })
}

// POST
// =============================================================================
exports.post = function (request, response, next) {
  exports.create(request.body).then(function (res) {
    response.model.data = res.data
    response.status(201)
    next()
  }, function (error) {
    response.model.errors.push(error.error)
    response.status(400)
    next()
  })
}

exports.create = function (query, root, client) {
  return new Promise(function (resolve, reject) {
    Rat.create(query, function (error, rat) {
      if (error) {
        let errorTypes = Object.keys(error.errors)

        for (let errorType of errorTypes) {
          error = error.errors[errorType].properties

          if (error.type === 'required') {
            let errorModel = ErrorModels.missing_required_field
            errorModel.detail = error.path
            reject({
              error: errorModel,
              meta: {}
            })
          } else {
            let errorModel = ErrorModels.server_error
            errorModel.detail = error.path
            reject({
              error: errorModel,
              meta: {}
            })
          }
        }
      } else {
        let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
          return cl.clientId !== client.clientId
        })
        websocket.broadcast(allClientsExcludingSelf, {
          action: 'rat:created'
        }, rat)
        resolve({
          data: rat,
          meta: {}
        })
      }
    })
  })
}

// PUT
// =============================================================================
exports.put = function (request, response, next) {
  response.model.meta.params = _.extend(response.model.meta.params, request.params)

  exports.update(request.body, null, request.params).then(function (data) {
    response.model.data = data.data
    response.status(201)
    next()
  }, function (error) {
    response.model.errors.push(error.error)

    let status = error.error.code || 400
    response.status(status)
    next()
  })
}

exports.update = function (data, client, query) {
  return new Promise(function (resolve, reject) {
    if (query.id) {
      Rat.findById(query.id, function (error, rat) {
        if (error) {
          let errorModel = ErrorModels.server_error
          errorModel.detail = error
          reject({
            error: errorModel,
            meta: {}
          })
        } else if (!rat) {
          let errorModel = ErrorModels.not_found
          errorModel.detail = query.id
          reject({
            error: errorModel,
            meta: {}
          })
        } else {
          for (let key in data) {
            if (key === 'client') {
              _.extend(rat.client, data)
            } else {
              rat[key] = data[key]
            }
          }

          rat.save(function (error, rat) {
            if (error) {
              let errorModel = ErrorModels.server_error
              errorModel.detail = error
              reject({
                error: errorModel,
                meta: {}
              })
            } else {
              let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
                return cl.clientId !== client.clientId
              })
              websocket.broadcast(allClientsExcludingSelf, {
                action: 'rat:updated'
              }, rat)
              resolve({
                data: rat,
                meta: {}
              })
            }
          })
        }
      })
    }
  })
}
