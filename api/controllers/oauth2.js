'use strict'

const oauth2orize = require('oauth2orize')
const crypto = require('crypto')
const Token = require('../db').Token
const Client = require('../db').Client
const Code = require('../db').Code
const Permission = require('../permission')
const Errors = require('../errors')
const i18next = require('i18next')
const localisationResources = require('../../localisations.json')

i18next.init({
  lng: 'en',
  resources:  localisationResources,
})

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

    callback(null, client.toJSON())
  }).catch(function (error) {
    callback(error)
  })
})

server.grant(oauth2orize.grant.code(function (client, redirectUri, user, ares, areq, callback) {
  for (let scope of areq.scope) {
    if (Permission.permissions.includes(scope) === false && scope !== '*') {
      callback(Errors.throw('invalid_scope', scope))
    }
  }

  Code.create({
    value: crypto.randomBytes(24).toString('hex'),
    scope: areq.scope,
    redirectUri: redirectUri
  }).then(function (code) {
    let associations = []
    associations.push(code.setClient(client.id))
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

server.grant(oauth2orize.grant.token(function (client, user, ares, areq, callback) {
  for (let scope of areq.scope) {
    if (Permission.permissions.includes(scope) === false && scope !== '*') {
      callback(Errors.throw('invalid_scope', scope))
    }
  }

  Token.create({
    value: crypto.randomBytes(32).toString('hex'),
    scope: areq.scope
  }).then(function (token) {
    let associations = []
    associations.push(token.setClient(client.id))
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
      scope: auth.scope,
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
    let translation = {
      requestingAccess: i18next.t('requestingAccess', { client: req.oauth2.client.name }),
      requestingAccessTo: i18next.t('requestingAccessTo', { client: req.oauth2.client.name }),
      authoriseTitle: i18next.t('authoriseTitle'),
      authoriseAllow: i18next.t('authoriseAllow'),
      authoriseDeny: i18next.t('authoriseDeny'),
      scopes: Permission.humanReadable(req.oauth2.req.scope, req.user)
    }

    console.log(translation)

    res.render('authorise.swig', {
      transactionId: req.oauth2.transactionID,
      user: req.user,
      client: req.oauth2.client,
      translation: translation,
      scope: req.oauth2.req.scope.join(' ')
    })
  }
]

exports.decision = [
  server.decision()
]

exports.token = [
  server.token(),
  server.errorHandler()
]
