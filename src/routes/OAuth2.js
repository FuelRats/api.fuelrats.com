import oauth2orize from 'oauth2orize-koa-fr'
import crypto from 'crypto'
import { Token, Client, Code, db, Session } from '../db'
import { ClientView } from '../view'
import Permission from '../classes/Permission'
import { NotFoundAPIError, UnprocessableEntityAPIError, VerificationRequiredAPIError } from '../classes/APIError'
import i18next from 'i18next'
import localisationResources from '../../localisations.json'
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
import DatabaseQuery from '../query/DatabaseQuery'

// noinspection JSIgnoredPromiseFromCall
i18next.init({
  lng: 'en',
  resources:  localisationResources
})

const server = oauth2orize.createServer()

server.serializeClient((client) => {
  return client.id
})

server.deserializeClient(async (id) => {
  const client = await Client.scope('user').findByPk(id)
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
  const auth = await Code.findOne({ where: { value: code } })

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
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent
    }
  })

  if (!existingSession) {
    await Sessions.createSession(ctx, user)
    throw new VerificationRequiredAPIError({})
  } else if (existingSession.verified === false) {
    await Sessions.sendSessionMail(user.email, user.preferredRat.name, existingSession.code, ctx)
    throw new VerificationRequiredAPIError({})
  }

  const token = await Token.create({
    value: crypto.randomBytes(global.OAUTH_TOKEN_LENTH).toString('hex'),
    clientId: client.id,
    userId: user.id,
    scope: ['*']
  })

  return token.value
}))

/**
 * Class managing OAuth related endpoints
 */
export default class OAuth2 extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return undefined
  }

  /**
   * Revoke an oauth token
   * @endpoint
   */
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

  /**
   * Revoke all of a client's oauth tokens
   * @inheritdoc
   */
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

  /**
   * Get the information required to render an authorize page
   * @endpoint
   */
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
      scopes: Permission.humanReadable({ scopes: ctx.state.oauth2.req.scope, connection: ctx }),
      scope: ctx.state.oauth2.req.scope.join(' ')
    }
  }

  /**
   * Authorization decision handler middleware
   * @endpoint
   */
  static authorizationDecisionHandler (ctx) {
    ctx.type = 'application/json'
    ctx.body = { redirectUri: ctx.data.redirectUri }
  }
}


/**
 * Validate the redirectUri of an authorize request
 * @endpoint
 */
export function validateRedirectUri (target, name, descriptor) {
  const endpoint = descriptor.value

  descriptor.value = async function (...args) {
    const [connection, next] = args
    await server.authorize(async (clientId, redirectUri) => {
      const client = await Client.scope('user').findByPk(clientId)
      if (!client) {
        return false
      }
      if (!client.redirectUri || client.redirectUri === redirectUri || !redirectUri) {
        const query = new DatabaseQuery({ connection })
        const clientView = (new ClientView({ object: client, query })).render()

        const clientRedirectUri = redirectUri || client.redirectUri
        return [clientView, clientRedirectUri]
      } else {
        throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/redirectUri' })
      }
    })(connection, next)
    return endpoint.apply(this, args)
  }
}

/**
 * Check whether these scopes are valid scopes that represent a permission in the API
 * @param {[string] }scopes
 */
function validateScopes (scopes) {
  const invalid = scopes.some((scope) => {
    return Permission.allPermissions.includes(scope) === false && scope !== '*'
  })
  if (invalid) {
    throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/scope' })
  }
}

OAuth2.server = server


