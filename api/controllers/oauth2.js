'use strict'

let oauth2orize = require('oauth2orize')
let crypto = require('crypto')
let Token = require('../db').Token
let Client = require('../db').Client
let Code = require('../db').Code
let Errors = require('../errors')
let Auth = require('./auth')

let server = oauth2orize.createServer()

server.serializeClient(function (client, callback) {
  return callback(null, client.id)
})

server.deserializeClient(function (id, callback) {
  Client.findById(id).then(function (client) {
    if (!client) {
      callback(null, false)
      return
    }

    callback(null, client)
  }).catch(function (error) {
    callback(error)
  })
})

server.grant(oauth2orize.grant.code(function (client, redirectUri, user, ares, callback) {
  Code.create({
    value: crypto.randomBytes(24).toString('hex'),
    redirectUri: redirectUri
  }).then(function (code) {
    let associations = []
    associations.push(code.setClient(client))
    associations.push(code.setUser(user.id))

    Promise.all(associations).then(function () {
      callback(null, code.value)
    }).catch(function (error) {
      callback(error)
    })
  }).catch(function (error) {
    callback(error)
  })
}))

server.grant(oauth2orize.grant.token(function (client, user, ares, callback) {
  Token.create({
    value: crypto.randomBytes(32).toString('hex')
  }).then(function (token) {
    let associations = []
    associations.push(token.setClient(client))
    associations.push(token.setUser(user.id))

    Promise.all(associations).then(function () {
      callback(null, token.value)
    }).catch(function (error) {
      callback(error)
    })
  }).catch(function (error) {
    callback(error)
  })
}))

server.exchange(oauth2orize.exchange.code(function (client, code, redirectUri, callback) {
  Code.findOne({ where: { value: code }}).then(function (auth) {
    if (!auth) {
      return callback(null, false)
    }

    if (client.id !== auth.clientId) {
      return callback(null, false)
    }

    if (redirectUri !== auth.redirectUri) {
      return callback(null, false)
    }

    auth.destroy()

    Token.create({
      value: crypto.randomBytes(32).toString('hex')
    }).then(function (token) {
      let associations = []
      associations.push(token.setClient(client))
      associations.push(token.setUser(auth.userId))

      Promise.all(associations).then(function () {
        callback(null, token.value)
      }).catch(function (error) {
        callback(error)
      })
    })
  }).catch(function (error) {
    callback(error)
  })
}))

server.exchange(oauth2orize.exchange.password(
  function (client, username, password, scope, callback) {
    Auth.passwordAuthenticate(username, password, function (err, user) {
      if (!user || err) {
        callback(err)
      }

      Token.create({
        value: crypto.randomBytes(32).toString('hex')
      }).then(function (token) {
        let associations = []
        associations.push(token.setClient(client.id))
        associations.push(token.setUser(user.id))

        Promise.all(associations).then(function () {
          callback(null, token.value)
        }).catch(function (error) {
          callback(error)
        })
      })
    })
  }
))

exports.authorization = [
  function (req, res, next) {
    if (!req.query.client_id) {
      return next(Errors.throw('missing_required_field', 'client_id'))
    } else if (!req.query.response_type) {
      return next(Errors.throw('missing_required_field', 'response_type'))
    }
    next()

  },
  server.authorization(function (clientId, redirectUri, callback) {
    Client.findById(clientId).then(function (client) {
      if (!client) {
        return callback(null, false)
      }
      if (client.redirectUri === null || client.redirectUri === redirectUri) {
        return callback(null, client, redirectUri)
      } else {
        return callback(Errors.throw('server_error', 'redirectUri mismatch'))
      }
    }).catch(function (error) {
      return callback(error)
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
