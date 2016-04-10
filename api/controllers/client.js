'use strict'
let Client = require('../models/client')
let ErrorModels = require('../errors')
let Permission = require('../permission')
let crypto = require('crypto')
let _ = require('underscore')

class ClientController {
  static read (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('client.read.self')
        reject({ error: error })
      }

      query = _.extend(query, { user: connection.user })
      Permission.require('client.create.self', connection.user).then(function () {
        Client.find(query, function (err, clients) {
          if (err) {
            let error = ErrorModels.server_error
            error.detail = err
            reject({ error: error })
          } else {
            resolve({ data: clients })
          }
        })
      }, function (error) {
        reject ({ error: error })
      })
    })
  }

  static create (data, connection) {
    return new Promise(function (resolve, reject) {
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('client.read.self')
        reject({ error: error })
      }

      Permission.require('client.create.self', connection.user).then(function () {
        let secret = crypto.randomBytes(24).toString('hex')

        let client = new Client({
          name: data.name,
          user: connection.user
        })

        Client.register(client, secret, function (err, client) {
          if (err) {
            let error = ErrorModels.server_error
            error.detail = err
            reject({ error: error })
          } else {
            let data = client.toJSON()
            data.secret = secret
            resolve({ data: data })
          }
        })
      }, function (error) {
        reject ({ error: error })
      })
    })
  }

  static update (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('client.update')
        reject({ error: error })
      }
    })
  }

  static delete (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('client.delete.self')
        reject({ error: error })
      }
    })
  }

  static httpGet (request, response, next) {
    ClientController.read(request.body, request).then(function (res) {
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

  static httpPost (request, response, next) {
    ClientController.create(request.body, request, request.query).then(function (res) {
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
}

module.exports = ClientController
