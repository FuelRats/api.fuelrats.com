'use strict'
let Permission = require('../permission')
let Errors = require('../errors')
let User = require('../db').User
let db = require('../db').db
let Rat = require('../db').Rat

let BotServ = require('../Anope/BotServ')


class Controller {
  static message (data) {
    return new Promise(function (resolve, reject) {
      if (!data.channel || data.channel.length === 0) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'channel') })
        return
      }

      if (!data.message || data.message.length === 0) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'message') })
        return
      }

      BotServ.say(data.channel, data.message).then(function (result) {
        resolve({ meta: {}, data: result })
      }).catch(function (error) {
        reject({ meta: {}, error: Errors.throw('server_error', error) })
      })
    })
  }

  static action (data) {
    return new Promise(function (resolve, reject) {
      if (!data.channel || data.channel.length === 0) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'channel') })
        return
      }

      if (!data.message || data.message.length === 0) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'message') })
        return
      }

      BotServ.act(data.channel, data.message).then(function (result) {
        resolve({ meta: {}, data: result })
      }).catch(function (error) {
        reject({ meta: {}, error: Errors.throw('server_error', error) })
      })
    })
  }
}

class HTTP {
  static message (request, response, next) {
    response.model.meta.params = Object.assign(response.model.meta.params, request.params)

    Controller.message(request.body, request, request.query).then(function (res) {
      response.model.data = res.data
      response.status = 201
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static action (request, response, next) {
    response.model.meta.params = Object.assign(response.model.meta.params, request.params)

    Controller.message(request.body, request, request.query).then(function (res) {
      response.model.data = res.data
      response.status = 201
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }
}
module.exports = { HTTP: HTTP, Controller: Controller }
