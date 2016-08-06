'use strict'
let _ = require('underscore')

class Controller {
  static info () {

  }

  static register () {

  }

  static connect () {

  }

  static delete () {

  }
}

class HTTP {
  static get (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
  }

  static post (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
  }

  static put (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
  }

  static delete (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.delete(request.body, request, request.query).then(function () {
      response.status(204)
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(error.error.code)
      next()
    })
  }
}

module.exports = { HTTP: HTTP, Controller: Controller }
