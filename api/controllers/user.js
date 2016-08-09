'use strict'

let _ = require('underscore')
let Permission = require('../permission')
let User = require('../db').User
let Rat = require('../db').Rat
let Errors = require('../errors')

class Controller {
  static read (query) {
    return new Promise(function (resolve, reject) {
      let limit = parseInt(query.limit) || 25
      delete query.limit

      let offset = parseInt(query.offset) || 0
      delete query.offset

      if (query.nicknames) {
        query.nicknames = { $contains: [query.nicknames] }
      }
      let dbQuery = {
        where: query,
        limit: limit,
        offset: offset,
        include: [
          {
            model: Rat,
            as: 'rats'
          }
        ]
      }

      User.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: limit,
          offset: offset,
          total: result.count
        }

        /* For backwards compatibility reasons we return only the list of rat
        foreign keys, not their objects */
        let users = result.rows.map(function (userInstance) {
          let user = convertUserToAPIResult(userInstance)
          return user
        })

        resolve({
          data: users,
          meta: meta
        })
      }).catch(function (error) {
        reject({ error: Errors.throw('server_error', error), meta: {} })
      })
    })
  }

  static create () {
    return new Promise(function (resolve, reject) {
      reject({ error: Errors.throw('not_implemented', 'rescue:create is not implemented, please use POST /register'), meta: {} })
    })
  }

  static update (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (query.id) {
        findUserWithRats({ id: query.id }).then(function (user) {
          let permission = connection.user.id === query.id ? 'self.user.edit' : 'user.edit'
          Permission.require(permission, connection.user).then(function () {
            let updates = []

            if (data.CMDRs) {
              for (let ratId of data.CMDRs) {
                updates.push(user.addRat(ratId))
              }
              delete data.rats
            }

            if (Object.keys(data).length > 0) {
              updates.push(User.update(data, {
                where: { id: user.id }
              }))
            }

            Promise.all(updates).then(function () {
              findUserWithRats({ id: query.id }).then(function (userInstance) {
                let user = convertUserToAPIResult(userInstance)
                resolve({ data: user, meta: {} })
              }).catch(function (error) {
                reject({ error: Errors.throw('server_error', error), meta: {} })
              })
            }).catch(function (error) {
              reject({ error: Errors.throw('server_error', error), meta: {} })
            })
          }, function (error) {
            reject({ error: error })
          })
        }, function (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
        })
      } else {
        reject({ error: Errors.throw('missing_required_field', 'id'), meta: {} })
      }
    })
  }

  static delete (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (connection.isUnauthenticated()) {
        let error = Permission.authenticationError('user.delete')
        reject({ error: error, meta: {} })
        return
      }

      if (query.id) {
        User.findById(query.id).then(function (rescue) {
          rescue.destroy()
          resolve({ data: null, meta: {} })
        }).catch(function (error) {
          reject({ error: Errors.throw('server_error', error), meta: {} })
        })
      } else {
        reject({ error: Errors.throw('missing_required_field', 'id'), meta: {} })
      }
    })
  }
}

class HTTP {
  static get (request, response, next) {
    Controller.read(request.query, request).then(function (res) {
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

  static getById (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
    let id = request.params.id
    if (id) {
      findUserWithRats({ id: id }).then(function (userInstance) {
        if (!userInstance) {
          response.model.errors.push(Errors.throw('not_found', 'id'))
          response.status(404)
          next()
          return
        }

        let user = convertUserToAPIResult(userInstance)
        response.model.data = user
        response.status(200)
        next()
      }).catch(function (error) {
        response.model.errors.push(Errors.throw('server_error', error))
        response.status(500)
        next()
      })
    } else {
      response.model.errors.push(Errors.throw('missing_required_field', 'id'))
      response.status(400)
      next()
    }
  }

  static post (request, response, next) {
    let notImplemented = Errors.throw('not_implemented', 'POST /users is not implemented, please use POST /register')
    response.model.errors.push(notImplemented)
    response.status(404)
    next()
  }

  static put (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.update(request.body, request, request.params).then(function (data) {
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

    Controller.delete(request.body, request, request.params).then(function () {
      response.status(204)
      next()
    }).catch(function (error) {
      response.model.errors.push(error)
      response.status(error.error.code)
      next()
    })
  }
}

function convertUserToAPIResult (userInstance) {
  let user = userInstance.toJSON()
  let reducedRats = user.rats.map(function (rat) {
    return rat.id
  })
  user.CMDRs = reducedRats
  if (!user.CMDRs) {
    user.CMDRs = []
  }
  delete user.rats
  delete user.salt
  delete user.password

  return user
}

function findUserWithRats (where) {
  return User.findOne({
    where: where,
    include: [
      {
        model: Rat,
        as: 'rats'
      }
    ]
  })
}

module.exports = { Controller, HTTP }
