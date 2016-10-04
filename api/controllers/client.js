'use strict'

let Client = require('../db').Client
let Permission = require('../permission')
let Errors = require('../errors')
let crypto = require('crypto')
let bcrypt = require('bcrypt')

class Controller {
  static read (data, connection, query) {
    return new Promise(function (resolve, reject) {
      let limit = parseInt(query.limit) || 25
      delete query.limit

      let offset = (parseInt(query.page) - 1) * limit || parseInt(query.offset) || 0
      delete query.offset
      delete query.page

      if (query.user) {
        query.UserId = query.user
        delete query.user
      }

      Client.findAndCountAll({
        where: query,
        limit: limit,
        offset: offset
      }).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: limit,
          offset: offset,
          total: result.count
        }

        let clients = result.rows.map(function (clientInstance) {
          let client = convertClientToAPIResult(clientInstance)
          return client
        })

        resolve({
          data: clients,
          meta: meta
        })
      }).catch(function (error) {
        reject({ error: Errors.throw('server_error', error), meta: {} })
      })
    })
  }

  static create (data, connection) {
    return new Promise(function (resolve, reject) {
      let secret = crypto.randomBytes(24).toString('hex')

      bcrypt.hash(secret, 16, function (error, hash) {
        if (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
          return
        }

        Client.create({
          name: data.name,
          secret: hash
        }).then(function (clientInstance) {
          clientInstance.setUser(connection.user.id).then(function () {
            let client = convertClientToAPIResult(clientInstance)
            client.secret = secret

            resolve({
              data: client,
              meta: {}
            })
          }).catch(function (error) {
            reject({ error: Errors.throw('server_error', error), meta: {} })
          })
        }).catch(function (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
        })
      })
    })
  }

  static update () {
    return new Promise(function (resolve, reject) {
      reject({ error: Errors.throw('not_implemented', 'client:update is not implemented, please contact the tech rats for changes'), meta: {} })
    })
  }

  static delete (data, connection, query) {
    return new Promise(function (resolve, reject) {
      console.log(query)
      if (query.id) {
        Permission.require('client.delete', connection.user).then(function () {
          Client.findById(query.id).then(function (client) {
            client.destroy()
            resolve({ data: null, meta: {} })
          }).catch(function (error) {
            reject({ error: Errors.throw('server_error', error), meta: {} })
          })
        }).catch(function (error) {
          reject({ error: error })
        })
      } else {
        reject({ error: Errors.throw('missing_required_field', 'id'), meta: {} })
      }
    })
  }
}

class HTTP {
  static get (request, response, next) {
    Controller.read(request.query, request, request.body).then(function (res) {
      let data = res.data

      response.model.data = data
      response.status = 200
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static post (request, response, next) {
    Controller.create(request.body, request, request.query).then(function (res) {
      let data = res.data

      response.model.data = data
      response.status(201)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static put (request, response, next) {
    let notImplemented = Errors.throw('not_implemented', 'PUT /clients is not implemented, please contact the tech rats for changes')
    response.model.errors.push(notImplemented)
    response.status(404)
    next()
  }

  static delete (request, response, next) {
    Controller.delete(request.body, request, request.params).then(function (res) {
      let data = res.data

      response.model.data = data
      response.status(204)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }
}

function convertClientToAPIResult (clientInstance) {
  let client = clientInstance.toJSON()
  client.user = client.userId
  delete client.userId
  delete client.secret

  return client
}

module.exports = { Controller, HTTP }
