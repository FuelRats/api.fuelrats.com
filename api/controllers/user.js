'use strict'

let _ = require('underscore')
let User = require('../models/user')
let ErrorModels = require('../errors')

// GET
// =============================================================================
exports.get = function (request, response, next) {
  exports.read(request.body).then(function (res) {
    let data = res.data

    response.model.data = data
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

  User.findById(id).populate('users').exec(function (error, user) {
    if (error) {
      response.model.errors.push(error)
      response.status(400)

    } else {
      response.model.data = user
      response.status(200)
    }

    next()
  })
}

exports.read = function (query) {
  return new Promise(function (resolve, reject) {
    User.find(query, function (error, dbData) {
      if (error) {
        let errorObj = ErrorModels.server_error
        errorObj.detail = error
        reject({
          error: errorObj,
          meta: {}
        })

      } else {
        resolve({
          data: dbData,
          meta: {}
        })
      }
    })
  })
}
