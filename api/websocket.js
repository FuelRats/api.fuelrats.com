var winston, badge, docs, login, logout, paperwork, rat, register, rescue, rescueAdmin, version, websocket, welcome, _

winston = require( 'winston' )

// Import controllers
login = require( './controllers/login' )
logout = require( './controllers/logout' )
paperwork = require( './controllers/paperwork' )
rat = require( './controllers/rat' )
register = require( './controllers/register' )
rescue = require( './controllers/rescue' )
version = require( './controllers/version' )
websocket = require( './websocket' )
_ = require( 'underscore' )

var APIControllers = {
  login: login,
  logout: logout,
  rat: rat,
  register: register,
  rescue: rescue,
  version: version
}

exports.socket = null

exports.received = function (client, requestString) {
  var controller, requestHasValidAction, request, requestSections, namespace, method, call

  try {
    request = JSON.parse(requestString)
    winston.info(request)

    requestHasValidAction = false
    if ( request.hasOwnProperty('action') ) {
      if ( typeof request.action == 'string' ) {
        requestHasValidAction = request.action.length > 2 && request.action.includes(':')
      }
    }

    if ( requestHasValidAction === true ) {
      requestSections = request.action.split(':')
      namespace = requestSections[0].toLowerCase()

      if ( APIControllers.hasOwnProperty(namespace) ) {
        controller = APIControllers.rescue
        method = requestSections[1].toLowerCase()
        if (method) {
          var query = _.clone( request )
          delete query.action

          console.log(query)

          controller[method].call( this, query ).then(function( response, meta ) {
            meta.action = request.action
            exports.send(client, meta, response)
          }, function( error ) {
            console.log(error)
          })
        } else {
          exports.error(client, { action: request.action }, ['Invalid action parameter'])
        }
      } else {
        exports.error(client, { action: request.action }, ['Third party API support has not yet been implemented'])
      }

    } else {
      exports.error(client, { action: null }, ['Missing action parameter'])
    }
  } catch (ex) {
    if ( request.hasOwnProperty('action') ) {
      if ( typeof request.action == 'string' ) {
        exports.error(client, { action: request.action }, [ex.message])
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
