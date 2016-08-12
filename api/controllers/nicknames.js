'use strict'
let _ = require('underscore')
let Anope = require('../Anope')
let Errors = require('../errors')
let User = require('../db').User
let Rat = require('../db').Rat


class Controller {
  static info (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (!query.nickname || query.nickname.length === 0) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'nickname') })
        return
      }

      Anope.info(query.nickname).then(function (info) {
        if (!info) {
          reject({ meta: {}, error: Errors.throw('not_found') })
          return
        }

        resolve({ meta: {}, data: anopeInfoToAPIResult(info, connection.user.group) })
      }).catch(function (error) {
        reject({ meta: {}, error: Errors.throw('server_error', error) })
      })
    })
  }

  static register (data, connection) {
    return new Promise(function (resolve, reject) {
      let fields = ['nickname', 'password']


      for (let field of fields) {
        if (!data[field]) {
          reject({ meta: {}, error: Errors.throw('missing_required_field', field) })
          return
        }
      }

      Anope.register(data.nickname, data.password, connection.user.email).then(function (nickname) {
        let nicknames = connection.user.nicknames
        nicknames.push(nickname)

        Anope.confirm(nickname).then(function () {
          User.update({ nicknames: nicknames }, {
            where: { id: connection.user.id }
          }).then(function () {
            User.findOne({
              where: { id: connection.user.id },
              include: [
                {
                  model: Rat,
                  as: 'rats',
                  required: false
                }
              ]
            }).then(function (user) {
              Anope.setVirtualHost(user, data.nickname)
            }).catch(function (error) {
              reject({ meta: {}, error: Errors.throw('server_error', error) })
            })
            resolve({ meta: {}, data: data.nickname })
          }).catch(function (error) {
            reject({ meta: {}, error: Errors.throw('server_error', error) })
          })
        }).catch(function (error) {
          reject({ meta: {}, error: Errors.throw('server_error', error) })
        })
      }).catch(function (error) {
        reject({ meta: {}, error: Errors.throw('server_error', error) })
      })
    })
  }

  static connect (data, connection) {
    return new Promise(function (resolve, reject) {
      let fields = ['nickname', 'password']

      for (let field of fields) {
        if (!data[field]) {
          reject({ meta: {}, error: Errors.throw('missing_required_field', field) })
          return
        }
      }

      Anope.authenticate(data.nickname, data.password).then(function () {
        let nicknames = connection.user.nicknames
        nicknames.push(data.nickname)

        User.update({ nicknames: nicknames }, {
          where: { id: connection.user.id }
        }).then(function () {
          User.findOne({
            where: { id: connection.user.id },
            include: [
              {
                model: Rat,
                as: 'rats',
                required: false
              }
            ]
          }).then(function (user) {
            Anope.setVirtualHost(user, data.nickname)
            resolve({ meta: {}, data: data.nickname })
          }).catch(function (error) {
            reject({ meta: {}, error: Errors.throw('server_error', error) })
          })
        }).catch(function (error) {
          reject({ meta: {}, error: Errors.throw('server_error', error) })
        })
      }).catch(function () {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      })
    })
  }

  static delete (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (!query.nickname) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', query.nickname) })
      }

      if (connection.user.nicknames.includes(query.nickname) || connection.user.group === 'admin') {
        Anope.drop(query.nickname).then(function () {
          resolve()
        }).catch(function (error) {
          reject({ meta: {}, error: Errors.throw('server_error', error) })
        })
      } else {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      }
    })
  }
}

class HTTP {
  static get (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.info(request.body, request, request.query).then(function (res) {
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
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.register(request.body, request, request.query).then(function (res) {
      response.model.data = res.data
      response.status(201)
      next()
    }, function (error) {
      response.model.errors.push(error)
      response.status(500)
      next()
    })
  }

  static put (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.connect(request.body, request, request.query).then(function (data) {
      response.model.data = data.data
      response.status(201)
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(error.error.code)
      next()
    })
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


function anopeInfoToAPIResult (result, group) {
  if (group !== 'admin') {
    if (result.vhost) {
      result.hostmask = result.vhost
      delete result.vhost
    }
    delete result.email
  }
  return result
}

module.exports = { HTTP: HTTP, Controller: Controller }
