'use strict'

const oauth2orize = require('oauth2orize-koa-fr')
const crypto = require('crypto')
const Token = require('../db').Token
const Client = require('../db').Client
const Code = require('../db').Code
const Permission = require('../permission')
const Errors = require('../errors')
const i18next = require('i18next')
const localisationResources = require('../../localisations.json')
const ClientsPresenter = require('../classes/Presenters').ClientsPresenter
const Authentication = require('./auth')

i18next.init({
  lng: 'en',
  resources:  localisationResources,
})

let server = oauth2orize.createServer()

server.serializeClient(function (client) {
  return client.data.id
})

server.deserializeClient(async function (id) {
  let client = await Client.findById(id)
  if (!client) {
    return false
  }

  return client
})

server.grant(oauth2orize.grant.code(async function (client, redirectUri, user, ares, areq) {
  for (let scope of areq.scope) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw Errors.template('invalid_scope', scope)
    }
  }

  redirectUri = redirectUri || client.redirectUri

  let code = await Code.create({
    value: crypto.randomBytes(24).toString('hex'),
    scope: areq.scope,
    redirectUri: redirectUri,
    clientId: client.id,
    userId: user.data.id
  })
  return code.value
}))

server.grant(oauth2orize.grant.token(async function (client, user, ares, areq) {
  for (let scope of areq.scope) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw Errors.template('invalid_scope', scope)
    }
  }

  let token = await Token.create({
    value: crypto.randomBytes(32).toString('hex'),
    scope: areq.scope,
    clientId: client.id,
    userId: user.data.id
  })
  return token.value
}))

server.exchange(oauth2orize.exchange.code(async function (client, code, redirectUri) {
  let auth = await Code.findOne({ where: { value: code }})

  if (!auth || client.data.id !== auth.clientId || redirectUri !== auth.redirectUri) {
    return false
  }

  auth.destroy()

  let token = await Token.create({
    scope: auth.scope,
    value: crypto.randomBytes(32).toString('hex'),
    clientId: client.id,
    userId: auth.userId
  })
  return token.value
}))

server.exchange(oauth2orize.exchange.password(
  async function (client, username, password) {
    let user = await Authentication.passwordAuthenticate(username, password)
    if (!user) {
      return false
    }

    let token = await Token.create({
      value: crypto.randomBytes(32).toString('hex'),
      clientId: client.data.id,
      userId: user.data.id,
      scope: ['*']
    })

    return token.value
  }
))

class OAuth2 {
  static async revoke (ctx) {
    if (!ctx.data.token) {
      throw Errors.template('missing_required_field', 'token')
    }

    let token = await Token.findOne({ where: { value: ctx.data.token } })
    if (!token) {
      throw Errors.template('not_found')
    }
    if (token.clientId !== ctx.state.client.data.id) {
      throw Errors.template('invalid_parameter', 'token')
    }

    token.destroy()
    return true
  }

  static async revokeAll (ctx) {
    let tokens = await Token.findAll({
      where: {
        clientId: ctx.state.client.id
      }
    })

    tokens.map((token) => {
      token.destroy()
    })

    return true
  }

  static async authorizationValidateFields (ctx, next) {
    if (!ctx.query.scope) {
      return next(Errors.template('missing_required_field', 'scope'))
    } else if (!ctx.query.client_id) {
      return next(Errors.template('missing_required_field', 'client_id'))
    } else if (!ctx.query.response_type) {
      return next(Errors.template('missing_required_field', 'response_type'))
    }
    await next()
  }

  static async authorizationRender (ctx, next) {
    let client = {}
    Object.assign(client, ctx.state.oauth2.client)
    delete client.secret

    ctx.body = {
      transactionId: ctx.state.oauth2.transactionID,
      user: ctx.user,
      client: client,
      scopes: Permission.humanReadable(ctx.state.oauth2.req.scope, ctx.user),
      scope: ctx.state.oauth2.req.scope.join(' ')
    }

    await next()
  }
}

OAuth2.authorizationValidateRedirect = server.authorize(async function (clientId, redirectUri) {
  let client = await Client.findById(clientId)
  if (!client) {
    return false
  }
  if (!client.redirectUri || client.redirectUri === redirectUri || !redirectUri) {
    redirectUri = redirectUri || client.redirectUri
    return [ClientsPresenter.render(client, {}), redirectUri]
  } else {
    throw Errors.template('server_error', 'redirectUri mismatch')
  }
})

OAuth2.server = server

module.exports = OAuth2

