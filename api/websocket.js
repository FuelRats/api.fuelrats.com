'use strict'
let winston = require('winston')
let Error = require('./errors')

// Import controllers
let Token = require('./db').Token
let User = require('./db').User
let rat = require('./controllers/rat').Controller
let Permission = require('./permission')
let rescue = require('./controllers/rescue').Controller
let stream = require('./controllers/stream')
let client = require('./controllers/client').Controller
let user = require('./controllers/user').Controller
let _ = require('underscore')

let controllers = {
  rats: {
    create: [rat.create],
    read: [rat.read],
    update: [rat.update, true],
    delete: [rat.delete, true, 'rat.delete']
  },

  rescues: {
    create: [rescue.create, true],
    read: [rescue.read],
    update: [rescue.update, true],
    delete: [rescue.delete, true, 'rescue.delete']
  },

  users: {
    create: [user.create, true],
    read: [user.read, true, 'user.read'],
    update: [user.update, true],
    delete: [user.delete, true, 'user.delete']
  },

  client: {
    create: [client.create, true, 'self.client.create'],
    read: [client.read, true, 'client.read'],
    update: [client.update, true, 'client.update'],
    delete: [client.delete, true, 'client.delete']
  },

  stream: {
    subscribe: [stream.subscribe, true],
    unsubscribe: [stream.unsubscribe, true]
  }
}


exports.retrieveCaseInsensitiveProperty = function (propertyName, obj) {
  if (!obj) { return null }

  propertyName = propertyName.toLowerCase()

  let caseInsensitivePropertyMap = Object.keys(obj).map(function (prop) {
    return prop.toLowerCase()
  })

  let indexOfProperty = caseInsensitivePropertyMap.indexOf(propertyName)

  if (indexOfProperty !== -1) {
    return obj[Object.keys(obj)[indexOfProperty]]
  }
  return null
}

exports.socket = null

exports.received = function (client, requestString) {
  let action, data, requestMeta, request
  try {
    request = JSON.parse(requestString)

    let requestHasValidAction = false
    let requestHadActionField = false
    action = exports.retrieveCaseInsensitiveProperty('action', request)
    data = exports.retrieveCaseInsensitiveProperty('data', request)
    requestMeta = exports.retrieveCaseInsensitiveProperty('meta', request)
    if (!requestMeta) { requestMeta = {} }
    if (!data) { data = {} }

    let query = _.clone(request)

    if (action) {
      requestHadActionField = true
      if (typeof action == 'string') {
        if (action === 'authorization') {
          exports.authorization(query, client, requestMeta)
          return
        }

        requestHasValidAction = action.length > 2 && action.includes(':')
      }
    }


    if (requestHasValidAction === true) {
      let requestSections = action.split(':')
      let namespace = requestSections[0].toLowerCase()

      if (controllers.hasOwnProperty(namespace)) {
        let controller = controllers[namespace]
        let method = requestSections[1].toLowerCase()

        if (method && controller[method]) {
          if (controller[method].length > 1) {
            let isAuthenticated = controller[method][1] === true

            if (isAuthenticated) {
              if (client.user) {
                if (controller[method].length > 2) {
                  Permission.require(controller[method][2]).then(function () {
                    client.websocket = exports
                    callAPIMethod(controller[method][0], data, client, query, action, requestMeta)
                  }).catch(function (error) {
                    exports.error(client, requestMeta, [error])
                  })
                }
                callAPIMethod(controller[method][0], data, client, query, action, requestMeta)
              } else {
                exports.error(client, requestMeta, [Permission.authenticationError()])
              }
              return
            }
          }

          callAPIMethod(controller[method][0], data, client, query, action, requestMeta)
        } else {
          exports.error(client, {
            action: action
          }, [Error.throw('invalid_parameter', 'action')])
        }
      } else {
        let applicationId = exports.retrieveCaseInsensitiveProperty('applicationId', request)
        if (!applicationId || applicationId.length === 0) {
          exports.error(client, {
            action: action
          }, [Error.throw('invalid_parameter', 'applicationId')])
          return
        }

        let callbackMeta = _.extend(requestMeta, {
          action: 'stream:broadcast',
          originalAction: action,
          applicationId: applicationId,
          id: client.clientId
        })

        exports.send(client, callbackMeta, data)

        let meta = _.extend(requestMeta, {
          action: action,
          applicationId: applicationId
        })

        let clients = exports.socket.clients.filter(function (cl) {
          return cl.subscribedStreams.indexOf(applicationId) !== -1 && cl.clientId !== client.clientId
        })

        exports.broadcast(clients, meta, data)
      }

    } else {
      let error
      if (requestHadActionField) {
        error = Error.invalid_parameter
      } else {
        error = Error.missing_required_field
      }

      let meta = _.extend(requestMeta, {
        action: 'unknown',
        id: client.clientId
      })

      error.detail = 'action'
      exports.error(client, meta, [error])
    }
  } catch (ex) {
    if (!requestMeta) { requestMeta = {} }
    if (request && action) {
      if (typeof action == 'string') {
        let error = Error.server_error
        error.detail = ex.message

        let meta = _.extend(requestMeta, {
          action: action,
          id: client.clientId
        })

        exports.error(client, meta, [error])
        return
      }
    }
    let error = Error.server_error
    error.detail = ex.message

    let meta = _.extend(requestMeta, {
      action: 'unknown',
      id: client.clientId
    })

    exports.error(client, meta, [error])
  }
}

function callAPIMethod (method, data, client, query, action, requestMeta) {
  method.call(null, data, client, query).then(function (response) {
    let data = response.data
    let meta = _.extend(requestMeta, response.meta)
    meta.action = action

    exports.send(client, meta, data)
  }, function (response) {
    let error = response.error
    let meta = _.extend(requestMeta, response.meta)
    meta.action = action

    exports.error(client, meta, [error])
  })
}

exports.send = function (client, meta, data) {
  if (meta.hasOwnProperty('action') === false) {
    winston.error('Missing action parameter in meta response.')
    return
  }

  let response = {
    meta: meta,
    data: data
  }

  client.send(JSON.stringify(response))
}

exports.broadcast = function (clients, meta, data) {
  if (meta.hasOwnProperty('action') === false) {
    winston.error('Missing action parameter in meta response.')
    return
  }

  let response = {
    meta: meta,
    data: data
  }

  let responseString = JSON.stringify(response)
  clients.forEach(function (client) {
    client.send(responseString)
  })
}

exports.error = function (client, meta, errors) {
  if (meta.hasOwnProperty('action') === false) {
    winston.error('Missing action parameter in meta response.')
    return
  }

  if (Object.prototype.toString.call(errors) !== '[object Array]') {
    winston.error('Provided error list was not an array')
    return
  }

  let response = {
    meta: meta,
    errors: errors
  }

  client.send(JSON.stringify(response))
}

exports.authorization = function (query, client, meta) {
  meta.action = 'authorization'

  let accessToken = query.bearer
  if (accessToken) {
    Token.findOne({ where: {
      value: accessToken
    }}).then(function (token) {
      if (!token) {
        exports.error(client, meta, [Permission.authenticationError()])
        return
      }
      User.findById(token.userId).then(function (user) {
        client.user = user.toJSON()

        delete client.user.salt
        delete client.user.password
        delete client.deletedAt

        exports.send(client, { action: 'authorization' }, user)
      }).catch(function (error) {
        exports.error(client, meta, [Error.throw('server_error', error)])
      })
    }).catch(function () {
      exports.error(client, meta, [Permission.authenticationError()])
    })
  } else {
    exports.error(client, meta, [Permission.authenticationError()])
  }
}
