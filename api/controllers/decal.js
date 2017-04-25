'use strict'

let Errors = require('../errors')
let Decal = require('../classes/Decal')

class Controller {
  static read (query) {
    return new Promise(function (resolve, reject) {

    })
  }
}

class HTTP {
  static check (request, response, next) {
    Decal.checkEligble(request.user).then(function () {
      response.model.data = {
        eligble: true
      }
      response.status = 200
      next()
    }).catch(function () {
      response.status = 204
      next()
    })
  }

  static redeem (request, response, next) {
    Decal.getDecalForUser(request.user).then(function (decal) {
      response.model.data = decal
      response.status = 200
      next()
    }).catch(function (errorData) {
      let error = Errors.throw('server_error', errorData)
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }
}



module.exports = {
  HTTP, Controller
}