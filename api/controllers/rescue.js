'use strict'

let _ = require('underscore')
let db = require('../db').db
let Rat = require('../db').Rat
let Rescue = require('../db').Rescue
let Epic = require('../db').Epic
let API = require('../classes/API')

let Errors = require('../errors')
let Permission = require('../permission')
let BotServ = require('../Anope/BotServ')
let Statistics = require('../classes/Statistics')

let lastRoundNumberRescue = null

class Controller {
  static read (query, connection) {
    return new Promise(function (resolve, reject) {

      if (!connection.user || connection.user.group.indexOf('admin') ===  -1) {
        delete query.client
      }
      let dbQuery = API.createQueryFromRequest(query)

      dbQuery.include = [
        {
          model: Rat,
          as: 'rats',
          require: false
        },
        {
          model: Epic,
          as: 'epics',
          require: false
        }
      ]

      if (query.rats) {
        dbQuery.include[0].require = true
        dbQuery.include[0].where = {
          id: query.rats
        }
      }

      Rescue.findAndCountAll(dbQuery).then(function (result) {
        let meta = {
          count: result.rows.length,
          limit: dbQuery.limit,
          offset: dbQuery.offset,
          total: result.count
        }

        /* For backwards compatibility reasons we return only the list of rat
        foreign keys, not their objects */
        let rescues = result.rows.map(function (rescueInstance) {
          let rescue = convertRescueToAPIResult(rescueInstance
            if (!connection.user || connection.user.group.indexOf('admin') ===  -1) {
              if (rescue.open === false) {
                rescue.client = null
              }
            }
          return rescue
        })

        resolve({
          data: rescues,
          meta: meta
        })
      }).catch(function (error) {
        let errorObj = Errors.server_error
        errorObj.detail = error
        reject({
          error: errorObj,
          meta: {}
        })
      })
    })
  }

  static create (query, connection) {
    return new Promise(function (resolve, reject) {
      let ratIds = query.rats
      delete query.rats
      let firstLimpet = query.firstLimpet
      delete query.firstLimpet

      Rescue.create(query).then(function (rescue) {
        if (!rescue) {
          reject({ error: Error.throw('operation_failed'), meta: {} })
          return
        }
        let getRatOperations = []

        if (ratIds) {
          for (let ratId of ratIds) {
            getRatOperations.push(Rat.findById(ratId))
          }
        }

        Promise.all(getRatOperations).then(function (rats) {
          let associations = []
          for (let rat of rats) {
            associations.push(rescue.addRat(rat))

            if (firstLimpet) {
              if (rat.id === firstLimpet) {
                associations.push(rescue.setFirstLimpet(rat))
              }
            }
          }

          Promise.all(associations).then(function () {
            findRescueWithRats({ id: rescue.id }).then(function (rescueInstance) {
              let rescue = convertRescueToAPIResult(rescueInstance)

              let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                return cl.clientId !== connection.clientId
              })

              Statistics.getOverviewStatistics().then(function (overviewInstance) {
                let overview = overviewInstance[0].toJSON()

                if ((overview.successCount % 1000) === 0 && overview.successCount !== lastRoundNumberRescue) {
                  lastRoundNumberRescue = overview.successCount
                  BotServ.say('#ratchat', `THIS IS RESCUE #${overview.successCount}!`)
                }
              })

              connection.websocket.broadcast(allClientsExcludingSelf, {
                action: 'rescue:created'
              }, rescue)

              resolve({
                data: rescue,
                meta: {}
              })
            })
          }).catch(function (error) {
            let errorModel = Errors.server_error
            errorModel.detail = error
            reject({
              error: errorModel,
              meta: {}
            })
          })
        }).catch(function (error) {
          let errorModel = Errors.server_error
          errorModel.detail = error
          reject({
            error: errorModel,
            meta: {}
          })
        })

      }).catch(function (error) {
        let errorModel = Errors.server_error
        errorModel.detail = error
        reject({
          error: errorModel,
          meta: {}
        })
      })
    })
  }

  static update (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (query.id) {
        findRescueWithRats({ id: query.id }).then(function (rescue) {
          if (!rescue) {
            reject({ error: Error.throw('not_found', rescue.id), meta: {} })
          }

          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getRescuePermissionType(rescue, connection.user)
          Permission.require(permission, connection.user).then(function () {
            let updates = []

            if (data.rats) {
              for (let ratId of data.rats) {
                updates.push(rescue.addRat(ratId))
              }
              delete data.rats
            }

            if (data.firstLimpet) {
              let firstLimpet = data.firstLimpet
              updates.push(rescue.setFirstLimpet(firstLimpet))
              delete data.firstLimpet
            }

            if (Object.keys(data).length > 0) {
              updates.push(Rescue.update(data, {
                where: { id: rescue.id }
              }))
            }

            Promise.all(updates).then(function () {
              findRescueWithRats({ id: query.id }).then(function (rescueInstance) {
                if (!rescueInstance) {
                  reject({ error: Error.throw('operation_failed'), meta: {} })
                  return
                }

                let rescue = convertRescueToAPIResult(rescueInstance)

                let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                  return cl.clientId !== connection.clientId
                })
                connection.websocket.broadcast(allClientsExcludingSelf, {
                  action: 'rescue:updated'
                }, rescue)

                if (connection.editForm && rescue.open === false) {
                  BotServ.say('#ratchat', `[API] Paperwork for rescue of ${rescue.client} in ${rescue.system} has been completed by ${getNickname(connection.user)}`)
                }

                resolve({
                  data: rescue,
                  meta: {}
                })

                resolve({ data: rescue, meta: {} })
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
      if (query.id) {
        Permission.require('rescue.delete', connection.user).then(function () {
          Rescue.findById(query.id).then(function (rescue) {
            if (!rescue) {
              reject({ error: Errors.throw('not_found', query.id), meta: {} })
              return
            }
            rescue.destroy()

            let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
              return cl.clientId !== connection.clientId
            })
            connection.websocket.broadcast(allClientsExcludingSelf, {
              action: 'rescue:deleted'
            }, { id: query.id })

            resolve({ data: null, meta: {} })
          }).catch(function (error) {
            reject({ error: Errors.throw('server_error', error), meta: {} })
          })
        }).catch(function (error) {
          reject({ error: error })
        })
      } else {
        reject({ error: Errors.throw('missing_required_field', 'id'), meta: {} })
      }
    })
  }

  static assign (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (query.id) {
        findRescueWithRats({ id: query.id }).then(function (rescue) {
          if (!rescue) {
            reject({ error: Error.throw('not_found', rescue.id), meta: {} })
            return
          }
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getRescuePermissionType(rescue, connection.user)

          Permission.require(permission, connection.user).then(function () {
            Rat.findById(data.ratId).then(function (rat) {
              rescue.addRat(rat).then(function () {
                findRescueWithRats({ id: query.id }).then(function (rescueInstance) {
                  if (!rescueInstance) {
                    reject({ error: Error.throw('operation_failed'), meta: {} })
                    return
                  }
                  let rescue = convertRescueToAPIResult(rescueInstance)

                  let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                    return cl.clientId !== connection.clientId
                  })
                  connection.websocket.broadcast(allClientsExcludingSelf, {
                    action: 'rescue:updated'
                  }, rescue)

                  resolve({
                    data: rescue,
                    meta: {
                      id: query.id
                    }
                  })
                }).catch(function (error) {
                  reject({ error: Errors.throw('server_error', error), meta: {} })
                })
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

  static unassign (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (query.id) {
        findRescueWithRats({ id: query.id }).then(function (rescue) {
          if (!rescue) {
            reject({ error: Error.throw('not_found', rescue.id), meta: {} })
            return
          }
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getRescuePermissionType(rescue, connection.user)

          Permission.require(permission, connection.user).then(function () {
            Rat.findById(data.ratId).then(function (rat) {
              rescue.removeRat(rat).then(function () {
                findRescueWithRats({ id: query.id }).then(function (rescueInstance) {
                  if (!rescueInstance) {
                    reject({ error: Error.throw('operation_failed'), meta: {} })
                    return
                  }
                  let rescue = convertRescueToAPIResult(rescueInstance)

                  let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                    return cl.clientId !== connection.clientId
                  })
                  connection.websocket.broadcast(allClientsExcludingSelf, {
                    action: 'rescue:updated'
                  }, rescue)

                  resolve({
                    data: rescue,
                    meta: {}
                  })
                }).catch(function (error) {
                  reject({ error: Errors.throw('server_error', error), meta: {} })
                })
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

  static addquote (data, connection, query) {
    return new Promise(function (resolve, reject) {
      if (query.id) {
        findRescueWithRats({ id: query.id }).then(function (rescue) {if (!rescue) {
          reject({ error: Error.throw('not_found'), meta: {} })
          return
        }
          // If the rescue is closed or the user is not involved with the rescue, we will require moderator permission
          let permission = getRescuePermissionType(rescue, connection.user)

          Permission.require(permission, connection.user).then(function () {
            let updatedQuotes = rescue.quotes.concat(data)
            Rescue.update(
              {
                quotes: updatedQuotes
              }, {
                where: { id: rescue.id }
              }).then(function () {
                findRescueWithRats({ id: query.id }).then(function (rescueInstance) {
                  if (!rescueInstance) {
                    reject({ error: Error.throw('operation_failed', rescue.id), meta: {} })
                    return
                  }
                  let rescue = convertRescueToAPIResult(rescueInstance)

                  let allClientsExcludingSelf = connection.websocket.socket.clients.filter(function (cl) {
                    return cl.clientId !== connection.clientId
                  })
                  connection.websocket.broadcast(allClientsExcludingSelf, {
                    action: 'rescue:updated'
                  }, rescue)
                  resolve({ data: rescue, meta: {} })
                }).catch(function (error) {
                  reject({ error: Errors.throw('server_error', error), meta: {} })
                })
              }).catch(function (error) {
                reject({ error: Errors.throw('server_error', error), meta: {} })
              }
            )
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
}

class HTTP {
  static assign (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.assign(request.params, request, request.params).then(function (data) {
      response.model.data = data.data
      response.status(200)
      next()
    }).catch(function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static unassign (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)

    Controller.unassign(request.params, request, request.params).then(function (data) {
      response.model.data = data.data
      response.status(200)
      next()
    }).catch(function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static addquote (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
    Controller.addquote(request.body.quotes, request, request.params).then(function (data) {
      response.model.data = data.data
      response.status(200)
      next()
    }, function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static get (request, response, next) {
    Controller.read(request.query, request).then(function (res) {
      let data = res.data
      let meta = res.meta

      response.model.data = data
      response.model.meta = meta
      response.status = 400
      next()
    }).catch(function (error) {
      response.model.errors.push(error.error)
      response.status(error.error.code)
      next()
    })
  }

  static getById (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
    let id = request.params.id

    if (id) {
      Rescue.findOne({
        where: { id: id },
        include: [
          {
            model: Rat,
            as: 'rats',
            required: false
          },
          {
            model: Rat,
            as: 'firstLimpet',
            required: false
          },
          {
            model: Epic,
            as: 'epics',
            required: false
          }
        ]
      }).then(function (rescueInstance) {
        if (request.query.v === '2') {
          response.model.data = rescueInstance.toJSON()
        } else {
          response.model.data = convertRescueToAPIResult(rescueInstance)
        }
        response.status(200)
        next()
      }).catch(function (error) {
        response.model.errors.push(error)
        response.status(400)
        next()
      })
    }
  }

  static post (request, response, next) {
    Controller.create(request.body, request).then(function (res) {
      response.model.data = res.data
      response.status(201)
      next()
    }, function (error) {
      response.model.errors.push(error)
      response.status(400)
      next()
    })
  }

  static put (request, response, next) {
    response.model.meta.params = _.extend(response.model.meta.params, request.params)
    request.editForm = request.query.editForm

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

function getRescuePermissionType (rescue, user) {
  if (rescue.open === true) {
    return 'self.rescue.update'
  }

  if (rescue.createdAt - Date.now() < 3600000) {
    return 'self.rescue.update'
  }

  if (user) {
    for (let CMDR of user.CMDRs) {
      if (rescue.rats.includes(CMDR) || rescue.firstLimpetId === CMDR) {
        return 'self.rescue.update'
      }
    }
  }
  return 'rescue.update'
}

function convertRescueToAPIResult (rescueInstance) {
  let rescue = rescueInstance.toJSON()
  if (rescue.rats) {
    let reducedRats = rescue.rats.map(function (rat) {
      return rat.id
    })
    rescue.rats = reducedRats
  } else {
    rescue.rats = []
  }

  rescue.epic = (rescue.epics.length > 0)
  delete rescue.epics

  delete rescue.firstLimpet
  rescue.firstLimpet = rescue.firstLimpetId
  delete rescue.firstLimpetId
  delete rescue.deletedAt
  return rescue
}

function findRescueWithRats (where) {
  return Rescue.findOne({
    where: where,
    include: [
      {
        model: Rat,
        as: 'rats',
        required: false
      },
      {
        model: Epic,
        as: 'epics',
        required: false
      }
    ]
  })
}

function getNickname (user) {
  if (user.nicknames.length > 0) {
    return user.nicknames[0]
  }
  return user.id
}

module.exports = { Controller, HTTP, getRescuePermissionType, findRescueWithRats, convertRescueToAPIResult }
