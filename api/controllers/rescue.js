'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')

let Rat = require('../models/rat')
let Rescue = require('../models/rescue')
let ErrorModels = require('../errors')
let websocket = require('../websocket')
let Permission = require('../permission')

class Controller {
  static read (query) {
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

  static create (query, client) {
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
              let find = Rat.findOne({
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

  static update (data, connection, query) {
    return new Promise(function (resolve, reject) {
      // Modifying a rescue requires an authenticated user
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('rescue.update')
        reject({ error: error })
        return
      }

      if (query.id) {
        retrieveRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
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
                  return cl.clientId !== connection.clientId
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
          }, function (err) {
            reject({ error: err })
          })
        }, function () {
          let errorModel = ErrorModels.not_found
          errorModel.detail = query.id
          reject({
            error: errorModel,
            meta: {}
          })
        })
      }
    })
  }

  static delete (query) {

  }

  static assign (data, connection, query) {
    return new Promise(function (resolve, reject) {
      // Modifying a rescue requires an authenticated user
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('rescue.update')
        reject({ error: error })
        return
      }

      if (query.id) {
        retrieveRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
            let update = {
              $addToSet: {
                rats: data.ratId
              }
            }

            let options = {
              new: true
            }

            Rescue.findByIdAndUpdate(query.id, update, options).then(function (rescue) {
              resolve({ data: rescue, meta: {} })
            }).catch(function (error) {
              reject({ error: error, meta: {} })
            })
          }, function () {

          })
        }, function () {

        })
      }
    })
  }

  static unassign (data, connection, query) {
    return new Promise(function (resolve, reject) {
      // Modifying a rescue requires an authenticated user
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('rescue.update')
        reject({ error: error })
        return
      }

      if (query.id) {
        retrieveRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
            let update = {
              $pull: {
                rats: data.ratId
              }
            }

            let options = {
              new: true
            }

            Rescue.findByIdAndUpdate(query.id, update, options).then(function (rescue) {
              resolve({ data: rescue, meta: {} })
            }).catch(function (error) {
              reject({ error: error, meta: {} })
            })
          }, function () {

          })
        }, function () {

        })
      }
    })
  }

  static addquote (data, connection, query) {
    return new Promise(function (resolve, reject) {
      // Modifying a rescue requires an authenticated user
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('rescue.update')
        reject({ error: error })
        return
      }

      if (query.id) {
        retrieveRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
            let update = {
              '$push': {
                quotes: data
              }
            }

            let options = {
              new: true
            }

            Rescue.findByIdAndUpdate(query.id, update, options, function (err, rescue) {
              if (err) {
                reject({ error: err, meta: {} })
              } else if (!rescue) {
                reject({ error: '404', meta: {} })
              } else {
                let allClientsExcludingSelf = websocket.socket.clients.filter(function (cl) {
                  return cl.clientId !== connection.clientId
                })
                websocket.broadcast(allClientsExcludingSelf, {
                  action: 'rescue:updated'
                }, rescue)
                resolve({ data: rescue, meta: {} })
              }
            })
          }, function () {

          })
        }, function () {

        })
      }
    })
  }
}

class HTTP {
  static assign (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.assign(request.params, null, request.params).then(function (data) {
      response.model.data = data.data
      response.status(200)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(400)
    })
  }

  static unassign (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.unassign(request.params, null, request.params).then(function (data) {
      response.model.data = data.data
      response.status(200)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(400)
    })
  }

  static addquote (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
    Controller.addquote(request.body.quotes, null, request.params).then(function (data) {
      response.model.data = data.data
      response.status(200)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(400)
    })
  }

  static get (request, response, next) {
    Controller.read(request.query).then(function (res) {
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

  static getById (request, response, next) {
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

    Controller.update(request.body, {}, request.params).then(function (data) {
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

  static delete (request, response, next) {

  }
}

function retrieveRescueById (id) {
  return new Promise(function (resolve, reject) {
    Rescue.findById(id).populate('rats').exec(function (error, rescue) {
      if (error) {
        reject(error)
      } else {
        resolve(rescue)
      }
    })
  })
}

function userEntitledToRescueAccess (rescue, user) {
  if (rescue.open === true) {
    return true
  }

  for (let CMDR of user.CMDRs) {
    if (rescue.rats.includes(CMDR)) {
      return true
    }
  }
  return false
}

module.exports = { Controller, HTTP }
