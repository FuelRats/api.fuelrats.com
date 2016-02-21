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

retrieveCaseInsensitiveProperty = function(propertyName, obj) {
  var indexOfProperty, caseInsensitivePropertyMap

  if (!obj) return null

  propertyName = propertyName.toLowerCase()

  caseInsensitivePropertyMap = Object.keys(obj).map(function(prop){
    return prop.toLowerCase()
  })

  indexOfProperty = caseInsensitivePropertyMap.indexOf(propertyName)

  if (indexOfProperty !== -1) {
    return obj[Object.keys(obj)[indexOfProperty]]
  }
  return null
}

exports.socket = null

exports.received = function (client, requestString) {
  var controller, requestHasValidAction, requestHadActionField, request, requestSections, namespace, method, call, error, applicationId, action, data, requestMeta

  try {
    request = JSON.parse(requestString)

    winston.info(request)

    requestHasValidAction = false
    requestHadActionField = false
    action = retrieveCaseInsensitiveProperty("action", request)
    data = retrieveCaseInsensitiveProperty("data", request)
    requestMeta = retrieveCaseInsensitiveProperty("meta", request)
    if (!requestMeta) requestMeta = {}
    if (!data) data = {}

    if ( action ) {
      requestHadActionField = true
      if ( typeof action == 'string' ) {
        requestHasValidAction = action.length > 2 && action.includes(':')
      }
    }

    if ( requestHasValidAction === true ) {
      requestSections = action.split(':')
      namespace = requestSections[0].toLowerCase()

      if ( APIControllers.hasOwnProperty(namespace) ) {
        controller = APIControllers[namespace]
        method = requestSections[1].toLowerCase()
        if (method && controller[method]) {
          var query = _.clone( request )

          controller[method].call( null, data, client, query ).then(function( response ) {
            var data = response.data
            var meta = _.extend( requestMeta, response.meta )
            meta.action = action

            exports.send(client, meta, data);
          }, function( response ) {
            var error = response.error
            var meta = _.extend( requestMeta, response.meta )
            meta.action = action

            exports.error(client, meta, [error])
          })
        } else {
          var error = ErrorModels.invalid_parameter
          error.detail = 'action'
          exports.error(client, { action: action }, [error])
        }
      } else {
        applicationId = retrieveCaseInsensitiveProperty("applicationId", request)
        if (!applicationId || applicationId.length === 0) {
          error = ErrorModels.invalid_parameter
          error.detail = 'applicationId'
          exports.error(client, { action: action }, [error])
          return
        }

        var callbackMeta = _.extend(requestMeta, {
          action: 'stream:broadcast',
          originalAction: action,
          applicationId: applicationId
        })

        exports.send(client, callbackMeta, data)

        var meta = _.extend( requestMeta, {
          action: action,
          applicationId: applicationId
        } )

        var clients = exports.socket.clients.filter(function (cl) {
          return cl.subscribedStreams.indexOf(applicationId) !== -1 && cl !== client
        })

        exports.broadcast(clients, meta, data)
      }

    } else {
      if (requestHadActionField) {
        error = ErrorModels.invalid_parameter
      } else {
        error = ErrorModels.missing_required_field
      }

      var meta = _.extend( requestMeta, { action: 'unknown' } )

      error.detail = 'action'
      exports.error(client, meta, [error])
    }
  } catch (ex) {
    if (!requestMeta) requestMeta = {};
    if ( request && action ) {
      if ( typeof action == 'string' ) {
        error = ErrorModels.server_error
        error.detail = ex.message

        var meta = _.extend( requestMeta, { action: action } )
        console.log(meta);

        exports.error(client, meta, [error])
        return
      }
    }
    error = ErrorModels.server_error
    error.detail = ex.message

    var meta = _.extend( requestMeta, { action: 'unknown' } )

    exports.error(client, meta, [error])
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
