'use strict'
let _ = require('underscore')
let Permission = require('../permission')
let Errors = require('../errors')
let User = require('../db').User
let db = require('../db').db
let Rat = require('../db').Rat

let NickServ = require('../Anope/NickServ')
let HostServ = require('../Anope/HostServ')


class Controller {
  static info (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (!query.nickname || query.nickname.length === 0) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'nickname') })
        return
      }

      NickServ.info(query.nickname).then(function (info) {
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

      NickServ.register(data.nickname, data.password, connection.user.email).then(function () {
        let nicknames = connection.user.nicknames
        nicknames.push(data.nickname)

        NickServ.confirm(data.nickname).then(function () {
          User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
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
              HostServ.updateVirtualHost(user).then(function () {
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

      NickServ.identify(data.nickname, data.password).then(function () {
        let nicknames = connection.user.nicknames
        nicknames.push(data.nickname)

        User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
          where: { id: connection.user.id }
        }).then(function () {
          User.findOne({
            where: { id: connection.user.id },
            attributes: {
              include: [
                [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
              ],
              exclude: [
                'nicknames'
              ]
            },
            include: [
              {
                model: Rat,
                as: 'rats',
                required: false
              }
            ]
          }).then(function (user) {
            HostServ.updateVirtualHost(user).then(function () {
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
      }).catch(function () {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      })
    })
  }

  static delete (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (!query.nickname) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'nickname') })
      }

      if (connection.user.nicknames.includes(query.nickname) || connection.user.group === 'admin') {
        NickServ.drop(query.nickname).then(function () {
          let nicknames = connection.user.nicknames
          nicknames.splice(nicknames.indexOf(query.nickname), 1)

          User.update({ nicknames: db.cast(nicknames, 'citext[]') }, {
            where: {
              id: connection.user.id
            }
          }).then(function () {
            resolve()
          }).catch(function (error) {
            reject({ meta: {}, error: Errors.throw('server_error', error) })
          })
        }).catch(function (error) {
          reject({ meta: {}, error: Errors.throw('server_error', error) })
        })
      } else {
        reject({ meta: {}, error: Errors.throw('no_permission') })
      }
    })
  }

  static search (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (!query.nickname) {
        reject({ meta: {}, error: Errors.throw('missing_required_field', 'nickname') })
      }

      let strippedNickname = query.nickname.replace(/\[(.*?)\]$/g, '')

      let displayPrivateFields = connection.user && Permission.granted('user.read', connection.user)

      let limit = parseInt(query.limit) || 25
      let offset = (parseInt(query.page) - 1) * limit || parseInt(query.offset) || 0
      let order = query.order || 'createdAt'
      let direction = query.direction || 'ASC'

      let dbQuery = {
        where: {
          nicknames: {
            $overlap:  db.literal(`ARRAY[${db.escape(query.nickname)}, ${db.escape(strippedNickname)}]::citext[]`)
          }
        },
        attributes: [
          'id',
          'createdAt',
          'updatedAt',
          'email',
          'drilled',
          'drilledDispatch',
          'group',
          [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        include: [{
          model: Rat,
          as: 'rats',
          require: false
        }],
        limit: limit,
        offset: offset,
        order: [
          [order, direction]
        ]
      }

      User.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: dbQuery.limit,
          offset: dbQuery.offset,
          total: result.count
        }

        let users = result.rows.map(function (userInstance) {
          let user = userInstance.toJSON()

          if (!displayPrivateFields) {
            user.email = null
          }

          user.rats = user.rats.map(function (rat) {
            delete rat.UserId
            delete rat.deletedAt
            return rat
          })

          return user
        })

        resolve({
          data: users,
          meta: meta
        })
      }).catch(function (error) {
        reject({ meta: {}, error: Errors.throw('server_error', error) })
      })
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

  static search (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.search(request.body, request, request.query).then(function (res) {
      response.model.data = res.data
      response.status(200)
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
