'use strict'

const websocket = require('../websocket')
const Error = require('../errors')

exports.subscribe = function (data, client, query) {
  return new Promise(function (resolve, reject) {
    let meta = {}

    let applicationId = websocket.retrieveCaseInsensitiveProperty('applicationId', query)

    if (applicationId && applicationId.length > 0) {

      if (client.subscribedStreams.indexOf(applicationId) === -1) {
        client.subscribedStreams.push(applicationId)
        resolve({
          data: client.subscribedStreams,
          meta: meta
        })
      } else {
        reject({
          error: Error.template('already_exists', applicationId),
          meta: {}
        })
      }
    } else {
      reject({
        error: Error.template('not_found', applicationId),
        meta: {}
      })
    }
  })
}

exports.unsubscribe = function (data, client, query) {
  return new Promise(function (resolve, reject) {
    let meta = {}

    let applicationId = websocket.retrieveCaseInsensitiveProperty('applicationId', query)

    if (applicationId && applicationId.length > 0) {
      let positionInSubscribeList = client.subscribedStreams.indexOf(applicationId)
      if (positionInSubscribeList !== -1) {
        client.subscribedStreams.splice(positionInSubscribeList, 1)
        resolve({
          data: client.subscribedStreams,
          meta: meta
        })
      } else {
        reject({
          error: Error.template('invalid_parameter', 'Not subscribed to this stream'),
          meta: {}
        })
      }
    } else {
      reject({
        error: Error.template('invalid_parameter', 'applicationId'),
        meta: {}
      })
    }
  })
}
