import oauth2orize from 'oauth2orize-koa-fr'
import crypto from 'crypto'
import { Token, Client, Code, db, Session } from '../db'
import Permission from '../classes/Permission'
import { NotFoundAPIError, UnprocessableEntityAPIError, VerificationRequiredAPIError } from '../classes/APIError'
import i18next from 'i18next'
import localisationResources from '../../localisations.json'
import Clients from './Clients'
import Authentication from '../classes/Authentication'
import Sessions from './Sessions'

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
  resources:  localisationResources
})

const server = oauth2orize.createServer()

server.serializeClient((client) => {
  return client.data.id
})

server.deserializeClient(async (id) => {
  const client = await Client.findByPk(id)
  if (!client) {
    return false
  }

  return client
})

server.grant(oauth2orize.grant.code(async (client, redirectUri, user, ares, areq) => {
  validateScopes(areq.scope)

  const clientRedirectUri = redirectUri || client.redirectUri

  const code = await Code.create({
    value: crypto.randomBytes(global.OAUTH_CODE_LENGTH).toString('hex'),
    scope: areq.scope,
    redirectUri: clientRedirectUri,
    clientId: client.id,
    userId: user.id
  })
  return code.value
}))

server.grant(oauth2orize.grant.token(async (client, user, ares, areq) => {
  validateScopes(areq.scope)

  const token = await Token.create({
    value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
    scope: areq.scope,
    clientId: client.id,
    userId: user.id
  })
  return token.value
}))

server.exchange(oauth2orize.exchange.code(async (client, code, redirectUri) => {
  const auth = await Code.findOne({ where: { value: code }})

  if (!auth || client.id !== auth.clientId || redirectUri !== auth.redirectUri) {
    return false
  }

  await auth.destroy()

  const token = await Token.create({
    scope: auth.scope,
    value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
    clientId: client.id,
    userId: auth.userId
  })
  return token.value
}))

server.exchange(oauth2orize.exchange.password(async (client, username, password, scope, ctx) => {
  const user = await Authentication.passwordAuthenticate({ email: username, password })
  if (!user) {
    return false
  }

  const existingSession = await Session.findOne({
    where: {
      ip: ctx.inet,
      userAgent: ctx.userAgent
    }
  })

  if (!existingSession) {
    await Sessions.createSession(ctx, user)
    throw new VerificationRequiredAPIError()
  } else if (existingSession.verified === false) {
    await Sessions.sendSessionMail(user.email, user.displayRat.name, existingSession.code, ctx)
    throw new VerificationRequiredAPIError()
  }

  const token = await Token.create({
    value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
    clientId: client.id,
    userId: user.id,
    scope: ['*']
  })

  return token.value
}))

export default class OAuth2 extends API {
  @POST('/oauth2/revoke')
  @clientAuthenticated
  @required('token')
  async revoke (ctx) {
    const token = await Token.findOne({ where: { value: ctx.data.token } })
    if (!token) {
      throw new NotFoundAPIError({ pointer: '/data/attributes/token' })
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
    const tokens = await Token.findAll({
      where: {
        clientId: ctx.state.client.id
      }
    })

    const transaction = await db.transaction()

    try {
      await Promise.all(tokens.map((token) => {
        return token.destroy({ transaction })
      }))

      await transaction.commit()
    } catch (ex) {
      await transaction.rollback()
      throw ex
    }

    return true
  }

  @GET('/oauth2/authorize')
  @authenticated
  @parameters('scope', 'client_id', 'response_type')
  @validateRedirectUri
  authorizationRender (ctx) {
    const client = {}
    Object.assign(client, ctx.state.oauth2.client)
    delete client.secret

    return {
      transactionId: ctx.state.oauth2.transactionID,
      user: ctx.user,
      client,
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
  const endpoint = descriptor.value

  descriptor.value = async function (...args) {
    const [connection, next] = args
    await server.authorize(async (clientId, redirectUri) => {
      const client = await Client.findByPk(clientId)
      if (!client) {
        return false
      }
      if (!client.redirectUri || client.redirectUri === redirectUri || !redirectUri) {
        const clientRedirectUri = redirectUri || client.redirectUri
        return [Clients.presenter.render(client, {}), clientRedirectUri]
      } else {
        throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/redirectUri' })
      }
    })(connection, next)
    return endpoint.apply(this, args)
  }
}

/**
 * Check wether these scopes are valid scopes that represent a permission in the API
 * @param scopes
 */
function validateScopes (scopes) {
  for (const scope of scopes) {
    if (Permission.allPermissions.includes(scope) === false && scope !== '*') {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/scope' })
    }
  }
}

OAuth2.server = server


