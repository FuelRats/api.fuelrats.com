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
    if (Permission.permissions.includes(scope) === false && scope !== '*') {
      throw Errors.template('invalid_scope', scope)
    }
  }

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
  console.log(client, user, ares, areq)
  for (let scope of areq.scope) {
    if (Permission.permissions.includes(scope) === false && scope !== '*') {
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

exports.authorizationValidateFields = async function (ctx, next) {
  if (!ctx.query.client_id) {
    return next(Errors.template('missing_required_field', 'client_id'))
  } else if (!ctx.query.response_type) {
    return next(Errors.template('missing_required_field', 'response_type'))
  }
  await next()
}

exports.authorizationValidateRedirect = server.authorize(async function (clientId, redirectUri) {
  let client = await Client.findById(clientId)
  if (!client) {

    return false
  }
  if (client.redirectUri === null || client.redirectUri === redirectUri) {
    return [ClientsPresenter.render(client, {}), redirectUri]
  } else {
    throw Errors.template('server_error', 'redirectUri mismatch')
  }
})

exports.authorizationRender = async function (ctx) {
  let translation = {
    requestingAccess: i18next.t('requestingAccess', { client: ctx.state.oauth2.client.data.attributes.name }),
    requestingAccessTo: i18next.t('requestingAccessTo', { client: ctx.state.oauth2.client.data.attributes.name }),
    authoriseTitle: i18next.t('authoriseTitle'),
    authoriseAllow: i18next.t('authoriseAllow'),
    authoriseDeny: i18next.t('authoriseDeny'),
    scopes: Permission.humanReadable(ctx.state.oauth2.req.scope, ctx.user)
  }

  await ctx.render('authorise', {
    transactionId: ctx.state.oauth2.transactionID,
    user: ctx.user,
    client: ctx.state.oauth2.client,
    translation: translation,
    scope: ctx.state.oauth2.req.scope.join(' ')
  })
}




exports.server = server

