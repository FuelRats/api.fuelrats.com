'use strict'

let Errors = require('../errors')
let Decal = require('../classes/Decal')

class HTTP {
  static check (request, response, next) {
    Decal.checkEligble(request.user).then(function () {
      response.model.data = {
        eligble: true
      }
      response.status = 200
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(error.code)
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
  HTTP
}