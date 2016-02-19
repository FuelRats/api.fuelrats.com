var winston, badge, docs, login, logout, paperwork, rat, register, rescue, rescueAdmin, version, websocket, welcome, _, ErrorModels

winston = require( 'winston' )
ErrorModels = require( './errors' )

// Import controllers
rat = require( './controllers/rat' )
rescue = require( './controllers/rescue' )
stream = require( './controllers/stream' )
version = require( './controllers/version' )
websocket = require( './websocket' )
_ = require( 'underscore' )

var APIControllers = {
  login: login,
  logout: logout,
  rats: rat,
  register: register,
  rescues: rescue,
  stream: stream,
  version: version
}

exports.socket = null

exports.received = function (client, requestString) {
  var controller, requestHasValidAction, requestHadActionField, request, requestSections, namespace, method, call, error

  try {
    request = JSON.parse(requestString)

    winston.info(request)

    requestHasValidAction = false
    requestHadActionField = false
    if ( request.hasOwnProperty('action') ) {
      requestHadActionField = true
      if ( typeof request.action == 'string' ) {
        requestHasValidAction = request.action.length > 2 && request.action.includes(':')
      }
    }

    if ( requestHasValidAction === true ) {
      requestSections = request.action.split(':')
      namespace = requestSections[0].toLowerCase()

      if ( APIControllers.hasOwnProperty(namespace) ) {
        controller = APIControllers[namespace]
        method = requestSections[1].toLowerCase()
        if (method && controller[method]) {
          var query = _.clone( request )
          delete query.action

          controller[method].call( null, query, client ).then(function( response ) {
            var data = response.data
            var meta = response.meta
            meta.action = request.action

            exports.send(client, meta, data);
          }, function( response ) {
            var error = response.error
            var meta = response.meta

            exports.error(client, meta, [error])
          })
        } else {
          var error = ErrorModels.invalid_parameter
          error.detail = 'action'
          exports.error(client, { action: request.action }, [error])
        }
      } else {
        if (!request.applicationId || request.applicationId.length === 0) {
          var error = ErrorModels.invalid_parameter
          error.detail = 'applicationId'
          exports.error(client, { action: request.action }, [error])
        }

        var callbackMeta = {
          action: 'stream:broadcast',
          originalAction: request.action,
          applicationId: request.applicationId
        }

        exports.send(client, callbackMeta, request.data)

        var meta = {
          action: request.action,
          applicationId: request.applicationId
        }

        var clients = exports.socket.clients.filter(function (cl) {
          return cl.subscribedStreams.indexOf(request.applicationId) !== -1 && cl !== client
        })

        exports.broadcast(clients, meta, request.data)
      }

    } else {
      if (requestHadActionField) {
        error = ErrorModels.invalid_parameter
      } else {
        error = ErrorModels.missing_required_field
      }
      error.detail = 'action'
      exports.error(client, { action: null }, [error])
    }
  } catch (ex) {
    if ( request && request.hasOwnProperty('action') ) {
      if ( typeof request.action == 'string' ) {
        var error = ErrorModels.server_error
        error.detail = ex.message
        exports.error(client, { action: request.action }, [error])
        return
      }
    }
    exports.error(client, { action: null }, [ex.message])
  }
}

exports.send = function(client, meta, data) {
  if ( meta.hasOwnProperty('action') === false ) {
    winston.error('Missing action parameter in meta response.')
    return
  }

  var response = {
    meta: meta,
    data: data
  }

  client.send(JSON.stringify(response))
}

exports.broadcast = function(clients, meta, data) {
  if ( meta.hasOwnProperty('action') === false ) {
    winston.error('Missing action parameter in meta response.')
    return
  }

  var response = {
    meta: meta,
    data: data
  }

  var responseString = JSON.stringify(response)
  clients.forEach(function(client) {
    client.send(responseString)
  })
}

exports.error = function(client, meta, errors) {
  if ( meta.hasOwnProperty('action') === false ) {
    winston.error('Missing action parameter in meta response.')
    return
  }

  if ( Object.prototype.toString.call(errors) !== '[object Array]' ) {
    winston.error('Provided error list was not an array')
    return
  }

  var response = {
    meta: meta,
    errors: errors
  }

  client.send(JSON.stringify(response))
}
