'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')

let Rat = require('../models/rat')
let Rescue = require('../models/rescue')
let ErrorModels = require('../errors')
let websocket = require('../websocket')

// ASSIGN
// =============================================================================
exports.assign = function (request, response, next) {
  response.model.meta.params = _.extend(response.model.meta.params, request.params)
  let rescueId = request.params.rescueId
  let ratId = request.params.ratId

  let update = {
    $push: {
      rats: ratId
    }
  }

  let options = {
    new: true
  }

  Rescue.findByIdAndUpdate(rescueId, update, options)
  .then(function (rescue) {
    response.model.data = rescue
    response.status(200)
    next()
  })
  .catch(function (error) {
    response.model.errors.push(error)
    response.status(400)
    next()
  })
}

// UNASSIGN
// =============================================================================
exports.unassign = function (request, response, next) {
  response.model.meta.params = _.extend(response.model.meta.params, request.params)
  let rescueId = request.params.rescueId
  let ratId = request.params.ratId

  let update = {
    $pull: {
      rats: ratId
    }
  }

  let options = {
    new: true
  }

  Rescue.findByIdAndUpdate(rescueId, update, options)
  .then(function (rescue) {
    response.model.data = rescue
    response.status(200)
    next()
  })
  .catch(function (error) {
    response.model.errors.push(error)
    response.status(400)
    next()
  })
}

// ADD QUOTE
// =============================================================================
exports.putAddQuote = function (request, response, next) {
  console.log('addquote')
  response.model.meta.params = _.extend(response.model.meta.params, request.params)
  exports.addquote(request.body.quotes, null, request.params).then(function (data) {
    response.model.data = data
    response.status(200)
    next()
  }, function (error) {
    response.model.errors.push(error)
    response.status(400)
  })

}

exports.addquote = function (data, client, query) {
  console.log(data)
  return new Promise(function (resolve, reject) {
    let update = {
      '$push': {
        quotes: data
      }
    }

    let options = {
      new: true
    }

    console.log(query.id)
    Rescue.findByIdAndUpdate(query.id, update, options, function (err, rescue) {
      console.log('findbyid')
      if (err) {
        console.log(err)
        reject({ error: err, meta: {} })
      } else if (!rescue) {
        console.log('no rescue')
        reject({ error: '404', meta: {} })
      } else {
        console.log('update')
        let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
          return cl.clientId !== client.clientId
        })
        websocket.broadcast(allClientsExcludingSelf, {
          action: 'rescue:updated'
        }, rescue)
        resolve({ data: rescue, meta: {} })
      }
    })
  })
}

// GET
// =============================================================================
exports.get = function (request, response, next) {

  exports.read(request.query).then(function (res) {
    let data = res.data
    let meta = res.meta

    response.model.data = data
    response.model.meta = meta
    response.status = 400
    next()
  }, function (error) {
    response.model.errors.push(error.error)
    response.status(400)
    next()
  })
}

// GET (by ID)
// =============================================================================
exports.getById = function (request, response, next) {
  response.model.meta.params = _.extend(response.model.meta.params, request.params)
  let id = request.params.id

  Rescue.findById(id).populate('rats').exec(function (error, rescue) {
    if (error) {
      response.model.errors.push(error)
      response.status(400)
    } else {
      response.model.data = rescue
      response.status(200)
    }

    next()
  })
}

// READ
// =============================================================================
exports.read = function (query) {
  return new Promise(function (resolve, reject) {
    let filter = {}
    let dbQuery = {}

    filter.size = parseInt(query.limit) || 25
    delete query.limit

    filter.from = parseInt(query.offset) || 0
    delete query.offset

    for (let key in query) {
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

    if (!Object.keys(dbQuery).length) {
      dbQuery.match_all = {}
    }

    Rescue.search(dbQuery, filter, function (error, queryData) {
      if (error) {
        let errorObj = ErrorModels.server_error
        errorObj.detail = error
        reject({
          error: errorObj,
          meta: {}
        })
      } else {
        let meta = {
          count: queryData.hits.hits.length,
          limit: filter.size,
          offset: filter.from,
          total: queryData.hits.total
        }

        let data = []

        queryData.hits.hits.forEach(function (rescue) {
          rescue._source._id = rescue._id
          rescue._source.score = rescue._score
          data.push(rescue._source)
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
  exports.create(request.body, {}).then(function (res) {
    response.model.data = res.data
    response.status(201)
    next()
  }, function (error) {
    response.model.errors.push(error)
    response.status(400)
    next()
  })
}

// CREATE
// =============================================================================
exports.create = function (query, client) {
  return new Promise(function (resolve, reject) {
    let finds = []

    if (typeof query.rats === 'string') {
      query.rats = query.rats.split(',')
    }

    query.unidentifiedRats = []

    if (query.rats) {
      query.rats.forEach(function (rat) {
        if (typeof rat === 'string') {
          if (!mongoose.Types.ObjectId.isValid(rat)) {
            let CMDRname = rat.trim()
            query.rats = _.without(query.rats, CMDRname)
            find = Rat.findOne({
              CMDRname: CMDRname
            })

            find.then(function (rat) {
              if (rat) {
                query.rats.push(rat._id)
              } else {
                query.unidentifiedRats.push(CMDRname)
              }
            })

            finds.push(find)
          }
        } else if (typeof rat === 'object' && rat._id) {
          query.rats.push(rat._id)
        }
      })
    }

    // Validate and update firstLimpet
    if (query.firstLimpet) {
      if (typeof query.firstLimpet === 'string') {
        if (!mongoose.Types.ObjectId.isValid(query.firstLimpet)) {
          let firstLimpetFind = Rat.findOne({
            CMDRname: query.firstLimpet.trim()
          })

          firstLimpetFind.then(function (rat) {
            if (rat) {
              query.firstLimpet = rat._id
            }
          })
          finds.push(firstLimpetFind)
        } else {
          query.firstLimpet =  mongoose.Types.ObjectId(query.firstLimpet)
        }
      } else if (typeof query.firstLimpet === 'object' && query.firstLimpet._id) {
        query.firstLimpet = query.firstLimpet._id
      }
    }
    Promise.all(finds).then(function () {
      Rescue.create(query, function (error, rescue) {
        if (error) {
          let errorObj = ErrorModels.server_error
          errorObj.detail = error
          reject({
            error: errorObj,
            meta: {}
          })
        } else {
          let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
            return cl.clientId !== client.clientId
          })
          websocket.broadcast(allClientsExcludingSelf, {
            action: 'rescue:created'
          }, rescue)
          resolve({
            data: rescue,
            meta: {}
          })
        }
      })
    })
  })
}

// PUT
// =============================================================================
exports.put = function (request, response, next) {
  response.model.meta.params = _.extend(response.model.meta.params, request.params)

  exports.update(request.body, {}, request.params).then(function (data) {
    response.model.data = data.data
    response.status(201)
    next()
  }, function (error) {
    response.model.errors.push(error)

    let status = error.code || 400
    response.status(status)
    next()
  })
}

// UPDATE
// =============================================================================
exports.update = function (data, client, query) {
  return new Promise(function (resolve, reject) {
    if (query.id) {
      Rescue.findById(query.id, function (error, rescue) {
        if (error) {
          let errorModel = ErrorModels.server_error
          errorModel.detail = error
          reject({
            error: errorModel,
            meta: {}
          })
        } else if (!rescue) {
          let errorModel = ErrorModels.not_found
          errorModel.detail = query.id
          reject({
            error: errorModel,
            meta: {}
          })
        } else {
          for (let key in data) {
            if (key === 'client') {
              _.extend(rescue.client, data)
            } else {
              rescue[key] = data[key]
            }
          }

          rescue.save(function (error, rescue) {
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
                action: 'rescue:updated'
              }, rescue)
              resolve({
                data: rescue,
                meta: {}
              })
            }
          })
        }
      })
    }
  })
}
