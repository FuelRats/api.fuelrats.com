'use strict'

const oauth2orize = require('oauth2orize-koa-fr')
const crypto = require('crypto')
const { Token, Client, Code } = require('../db')
const Permission = require('../permission')
const Errors = require('../errors')
const i18next = require('i18next')
const localisationResources = require('../../localisations.json')
const { ClientsPresenter } = require('../classes/Presenters')
const Authentication = require('./auth')

const OAUTH_CODE_LENGTH = 24
const OAUTH_TOKEN_LENTH = 32

i18next.init({
  lng: 'en',
  resources:  localisationResources,
})

let server = oauth2orize.createServer()

server.serializeClient(function (client) {
  return client.data.id
})

server.deserializeClient(async function (id) {
  let client = await Client.findByPk(id)
  if (!client) {
    return false
  }

  return client
})

server.grant(oauth2orize.grant.code(async function (client, redirectUri, user, ares, areq) {
  validateScopes(areq.scope)

  redirectUri = redirectUri || client.redirectUri

  let code = await Code.create({
    value: crypto.randomBytes(OAUTH_CODE_LENGTH).toString('hex'),
    scope: areq.scope,
    redirectUri: redirectUri,
    clientId: client.id,
    userId: user.data.id
  })
  return code.value
}))

server.grant(oauth2orize.grant.token(async function (client, user, ares, areq) {
  validateScopes(areq.scope)

  let token = await Token.create({
    value: crypto.randomBytes(OAUTH_TOKEN_LENTH).toString('hex'),
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
    value: crypto.randomBytes(OAUTH_TOKEN_LENTH).toString('hex'),
    clientId: client.data.id,
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
      value: crypto.randomBytes(OAUTH_TOKEN_LENTH).toString('hex'),
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
    let {clientId} = ctx.data
    if (clientId) {
      if (!Permission.granted(['user.write'], ctx.state.user, ctx.state.scope)) {
        throw Permission.permissionError(['user.write'])
      }
    } else {
      clientId = ctx.state.client.id
    }

    let tokens = await Token.findAll({
      where: {
        clientId: clientId
      }
    })

    tokens.map((token) => {
      token.destroy()
    })

    return true
  }

  static async authorizationValidateFields (ctx, next) {
    if (ctx.query.access_type) {
      delete ctx.query.access_type
    }

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
    let client = await Client.scope('public').findOne({
      where: {
        id: ctx.state.oauth2.client.data.id
      }
    })

    let existingToken = await Token.findOne({ where: { userId: ctx.state.user.data.id, clientId: ctx.query.client_id } })

    ctx.body = {
      transactionId: ctx.state.oauth2.transactionID,
      user: ctx.user,
      client: ClientsPresenter.render(client, {}),
      scopes: Permission.humanReadable(ctx.state.oauth2.req.scope, ctx.state.user),
      scope: ctx.state.oauth2.req.scope.join(' '),
      preAuthorized: (Boolean(existingToken))
    }

    await next()
  }
}

OAuth2.authorizationValidateRedirect = server.authorize(async function (clientId, redirectUri) {
  let client = await Client.findByPk(clientId)
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

/**
 * Check wether these scopes are valid scopes that represent a permission in the API
 * @param scopes
 */
function validateScopes (scopes) {
  for (let scope of scopes) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw Errors.template('invalid_scope', scope)
    }
  }
}

OAuth2.server = server

module.exports = OAuth2

