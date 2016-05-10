'use strict'

let oauth2orize = require('oauth2orize')
let crypto = require('crypto')
let Client = require('../models/client')
let Token = require('../models/token')
let Code = require('../models/code')

let server = oauth2orize.createServer()

server.serializeClient(function (client, callback) {
  return callback(null, client.name)
})

server.deserializeClient(function (id, callback) {
  Client.findOne({ name: id }, function (err, client) {
    if (err) {
      return callback(err)
    }
    return callback(null, client)
  })
})

server.grant(oauth2orize.grant.code(function (client, redirectUri, user, ares, callback) {
  let code = new Code({
    value: crypto.randomBytes(24).toString('hex'),
    client: client,
    redirectUri: redirectUri,
    user: user
  })

  code.save(function (err) {
    if (err) {
      return callback(err)
    }

    callback(null, code.value)
  })
}))

server.exchange(oauth2orize.exchange.code(function (client, code, redirectUri, callback) {
  Code.findOne({ value: code }, function (err, authCode) {
    if (err) {
      return callback(err)
    }
    if (authCode === undefined) {
      return callback(null, false)
    }
    if (client.name !== authCode.client.name) {
      return callback(null, false)
    }
    if (redirectUri !== authCode.redirectUri) {
      return callback(null, false)
    }

    authCode.remove(function (err) {
      if(err) {
        return callback(err)
      }


      let token = new Token({
        value: crypto.randomBytes(256).toString('hex'),
        client: client,
        user: authCode.user
      })

      // Save the access token and check for errors
      token.save(function (err) {
        if (err) {
          return callback(err)
        }

        callback(null, token)
      })
    })
  })
}))

exports.authorization = [
  server.authorization(function (clientId, redirectUri, callback) {

    Client.findOne({ name: clientId }, function (err, client) {
      if (err) {
        return callback(err)
      }
      return callback(null, client, redirectUri)
    })
  }),
  function (req, res) {
    res.render('authorise.swig', { transactionId: req.oauth2.transactionID, user: req.user, client: req.oauth2.client })
  }
]

exports.decision = [
  server.decision()
]

exports.token = [
  server.token(),
  server.errorHandler()
]
