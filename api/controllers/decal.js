'use strict'

const Errors = require('../errors')
const Decal = require('../classes/Decal')
const User = require('../db').User
const Permission = require('../permission')

class HTTP {
  static check (request, response, next) {
    if (Object.keys(request.query).length > 0) {
      Permission.require('user.read', request.user).then(function () {
        User.findOne({
          where: request.query
        }).then(function (user) {
          if (!user) {
            let error = Error.template('not_found', 'user')
            response.model.errors.push(error)
            response.status(error.code)
            next()
          }

          Decal.checkEligble(user).then(function () {
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
        })
      }).catch(function (error) {
        response.model.errors.push(error)
        response.status(error.error.code)
        next()
      })
    } else {
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