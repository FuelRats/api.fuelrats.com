

import oauth2orize from 'oauth2orize-koa-fr'
import crypto from 'crypto'
import { Token, Client, Code, db } from '../db'
import Permission from '../classes/Permission'
import {NotFoundAPIError, UnauthorizedAPIError, UnprocessableEntityAPIError} from '../classes/APIError'
import i18next from 'i18next'
import localisationResources from '../../localisations.json'
import Clients from './Clients'
import Authentication from '../classes/Authentication'
import API, {
  clientAuthenticated,
  authenticated,
  GET,
  POST,
  required,
  parameters
} from '../classes/API'

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
  validateScopes(areq.scope)

  redirectUri = redirectUri || client.redirectUri

  let code = await Code.create({
    value: crypto.randomBytes(global.OAUTH_CODE_LENGTH).toString('hex'),
    scope: areq.scope,
    redirectUri: redirectUri,
    clientId: client.id,
    userId: user.id
  })
  return code.value
}))

server.grant(oauth2orize.grant.token(async function (client, user, ares, areq) {
  validateScopes(areq.scope)

  let token = await Token.create({
    value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
    scope: areq.scope,
    clientId: client.id,
    userId: user.id
  })
  return token.value
}))

server.exchange(oauth2orize.exchange.code(async function (client, code, redirectUri) {
  let auth = await Code.findOne({ where: { value: code }})

  if (!auth || client.id !== auth.clientId || redirectUri !== auth.redirectUri) {
    return false
  }

  await auth.destroy()

  let token = await Token.create({
    scope: auth.scope,
    value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
    clientId: client.id,
    userId: auth.userId
  })
  return token.value
}))

server.exchange(oauth2orize.exchange.password(
  async function (client, username, password) {
    let user = await Authentication.passwordAuthenticate({email: username, password})
    if (!user) {
      return false
    }

    let token = await Token.create({
      value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
      clientId: client.id,
      userId: user.id,
      scope: ['*']
    })

    return token.value
  }
))

export default class OAuth2 extends API {
  @POST('/oauth2/revoke')
  @clientAuthenticated
  @required('token')
  async revoke (ctx) {
    let token = await Token.findOne({ where: { value: ctx.data.token } })
    if (!token) {
      throw NotFoundAPIError({ pointer: '/data/attributes/token' })
    }
    if (token.clientId !== ctx.state.client.id) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/clientId' })
    }

    await token.destroy()
    return true
  }

  @POST('/oauth2/revokeall')
  @clientAuthenticated
  async revokeAll (ctx) {
    let tokens = await Token.findAll({
      where: {
        clientId: ctx.state.client.id
      }
    })

    let transaction = await db.transaction()

    try {
      await Promise.all(tokens.map((token) => {
        token.destroy({ transaction })
      }))

      await transaction.commit()
    } catch (ex) {
      transaction.rollback()
      throw ex
    }

    return true
  }

  @GET('/oauth2/authorize')
  @authenticated
  @parameters('scope', 'client_id', 'response_type')
  @validateRedirectUri
  authorizationRender (ctx) {
    let client = {}
    Object.assign(client, ctx.state.oauth2.client)
    delete client.secret

    return {
      transactionId: ctx.state.oauth2.transactionID,
      user: ctx.user,
      client: client,
      scopes: Permission.humanReadable({scopes: ctx.state.oauth2.req.scope, user: ctx.state.user}),
      scope: ctx.state.oauth2.req.scope.join(' ')
    }
  }
}

/**
 *
 * @param target
 * @param name
 * @param descriptor
 */
export function validateRedirectUri (target, name, descriptor) {
  let endpoint = descriptor.value

  descriptor.value = async function (ctx, next) {
    await server.authorize(async function (clientId, redirectUri) {
      let client = await Client.findById(clientId)
      if (!client) {
        return false
      }
      if (!client.redirectUri || client.redirectUri === redirectUri || !redirectUri) {
        redirectUri = redirectUri || client.redirectUri
        return [Clients.presenter.render(client, {}), redirectUri]
      } else {
        throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/redirectUri' })
      }
    })(ctx, next)
    return endpoint.apply(this, arguments)
  }
}

/**
 * Check wether these scopes are valid scopes that represent a permission in the API
 * @param scopes
 */
function validateScopes (scopes) {
  for (let scope of scopes) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/scope' })
    }
  }
}

OAuth2.server = server


