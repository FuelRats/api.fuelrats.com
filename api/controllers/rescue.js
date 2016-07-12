'use strict'

let _ = require('underscore')
let db = require('../db').db
let Rat = require('../db').Rat
let Rescue = require('../db').Rescue

let mongoose = require('mongoose')

let MongoRat = require('../models/rat')
let MongoRescue = require('../models/rescue')
let ErrorModels = require('../errors')
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
        offset: offset,
        include: [
          {
            model: Rat,
            as: 'rats',
            required: true
          }
        ]
      }

      Rescue.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: limit,
          offset: offset,
          total: result.count
        }

        /* For backwards compatibility reasons we return only the list of rat
        foreign keys, not their objects */
        let rescues = result.rows.map(function (rescueInstance) {
          let rescue = rescueInstance.toJSON()
          let reducedRats = rescue.rats.map(function (rat) {
            return rat.id
          })
          rescue.rats = reducedRats

          rescue.firstLimpet = rescue.firstLimpetId
          delete rescue.firstLimpetId
          return rescue
        })

        resolve({
          data: rescues,
          meta: meta
        })
      }).catch(function (error) {
        let errorObj = ErrorModels.server_error
        errorObj.detail = error
        reject({
          error: errorObj,
          meta: {}
        })
      })
    })
  }

  static create (query, client) {
    return new Promise(function (resolve, reject) {
      let finds = []

      if (typeof query.rats === 'string') {
        query.rats = query.rats.split(',')
      }

      query.unidentifiedMongoRats = []

      if (query.rats) {
        query.rats.forEach(function (rat) {
          if (typeof rat === 'string') {
            if (!mongoose.Types.ObjectId.isValid(rat)) {
              let CMDRname = rat.trim()
              query.rats = _.without(query.rats, CMDRname)
              let find = MongoRat.findOne({
                CMDRname: CMDRname
              })

              find.then(function (rat) {
                if (rat) {
                  query.rats.push(rat._id)
                } else {
                  query.unidentifiedMongoRats.push(CMDRname)
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
            let firstLimpetFind = MongoRat.findOne({
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
        MongoRescue.create(query, function (error, rescue) {
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
        retrieveMongoRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToMongoRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

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
        retrieveMongoRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToMongoRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
            let update = {
              $addToSet: {
                rats: data.ratId
              }
            }

            let options = {
              new: true
            }

            MongoRescue.findByIdAndUpdate(query.id, update, options).then(function (rescue) {
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
        retrieveMongoRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToMongoRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
            let update = {
              $pull: {
                rats: data.ratId
              }
            }

            let options = {
              new: true
            }

            MongoRescue.findByIdAndUpdate(query.id, update, options).then(function (rescue) {
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
        retrieveMongoRescueById(query.id).then(function (rescue) {
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = userEntitledToMongoRescueAccess(rescue, connection.user) ? 'self.rescue.update' : 'rescue.update'

          Permission.require(permission, connection.user).then(function () {
            let update = {
              '$push': {
                quotes: data
              }
            }

            let options = {
              new: true
            }

            MongoRescue.findByIdAndUpdate(query.id, update, options, function (err, rescue) {
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

    MongoRescue.findById(id).populate('rats').exec(function (error, rescue) {
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

function retrieveMongoRescueById (id) {
  return new Promise(function (resolve, reject) {
    MongoRescue.findById(id).populate('rats').exec(function (error, rescue) {
      if (error) {
        reject(error)
      } else {
        resolve(rescue)
      }
    })
  })
}

function userEntitledToMongoRescueAccess (rescue, user) {
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
