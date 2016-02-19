var _, winston, ErrorModels

_ = require( 'underscore' )
winston = require( 'winston' )

ErrorModels = require( '../errors' )

exports.subscribe = function( data, client, query ) {
  return new Promise(function(resolve, reject) {
    var applicationId, meta

    meta = {}

    console.log(query)

    if (query.applicationId && query.applicationId.length > 0) {
      applicationId = query.applicationId

      if (client.subscribedStreams.indexOf(applicationId) === -1) {
        client.subscribedStreams.push(applicationId)
        console.log('resolving')
        resolve({ data: client.subscribedStreams, meta: meta })
      } else {
        reject( { error: 'Already subscribed to this stream', meta: {} })
      }
    } else {
      reject({ error: 'Invalid application ID', meta: {} })
    }
  })
}

exports.unsubscribe = function( data, client, query ) {
  return new Promise(function(resolve, reject) {
    var applicationId, meta, positionInSubscribeList

    meta = {}

    if (query.applicationId && query.applicationId.length > 0) {
      applicationId = query.applicationId

      positionInSubscribeList = client.subscribedStreams.indexOf(applicationId)
      if (positionInSubscribeList !== -1) {
        client.subscribedStreams.splice(positionInSubscribeList, 1)
        resolve({ data: client.subscribedStreams, meta: meta })
      } else {
        reject( { error: 'Not subscribed to this stream', meta: {} })
      }
    } else {
      reject({ error: 'Invalid application ID', meta: {} })
    }
  })
}
