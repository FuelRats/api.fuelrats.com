import fs from 'fs'
import http from 'http'
import Koa from 'koa'
import koaBody from 'koa-body'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import querystring from 'koa-qs'
import session from 'koa-session'
import npid from 'npid'
import { promisify } from 'util'
import Document from './Documents/Document'
import ErrorDocument from './Documents/ErrorDocument'
import {
  TooManyRequestsAPIError,
  ImATeapotAPIError,
  InternalServerError,
  NotFoundAPIError,
  ForbiddenAPIError, UnauthorizedAPIError,
} from './classes/APIError'
import Authentication from './classes/Authentication'
import Permission from './classes/Permission'
import router from './classes/Router'
import StatusCode from './classes/StatusCode'
import TrafficControl from './classes/TrafficControl'
import WebSocket from './classes/WebSocket'
import config from './config'
import { db } from './db'
import logger from './logging'
import Query from './query'
import * as routes from './routes'
import oauth2 from './routes/OAuth2'

const packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf8'))


const app = new Koa()
querystring(app)



// Import controllers
global.WEBSOCKET_IDENTIFIER_ROUNDS = 16
global.BCRYPT_ROUNDS_COUNT = 16
global.OAUTH_CODE_LENGTH = 24
global.OAUTH_TOKEN_LENTH = 32
global.UUID_VERSION = 4

try {
  npid.remove('api.pid')
  const pid = npid.create('api.pid')
  pid.removeOnExit()
} catch (err) {
  process.exit(1)
}

if (config.server.proxyEnabled) {
  app.proxy = true
}

app.keys = [config.server.cookieSecret]

const sessionConfiguration = {
  key: 'fuelrats:session',
  overwrite: true,
  signed: true,
}

app.use(conditional())
app.use(etag())
app.use(session(sessionConfiguration, app))
app.use(koaBody({
  strict: false,
  multipart: true,
}))

/**
 * Parses an object of URL query parameters and builds a nested object by delimiting periods into sub objects.
 * @param {[object]} query an array of URL query parameters
 * @returns {{}} a nested object
 */
function parseQuery (query) {
  return Object.entries(query).reduce((acc, [key, value]) => {
    const [last, ...paths] = key.split('.').reverse()
    const object = paths.reduce((pathAcc, el) => {
      return { [el]: pathAcc }
    }, { [last]: value })
    return { ...acc, ...object }
  }, {})
}

app.use((ctx, next) => {
  ctx.data = ctx.request.body
  ctx.client = {}

  const { query } = ctx
  ctx.query = parseQuery(query)

  ctx.state.userAgent = ctx.request.headers['user-agent']


  return next()
})

app.use((ctx, next) => {
  if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
    ['createdAt', 'updatedAt', 'deletedAt', 'revision'].map((cleanField) => {
      delete ctx.data[cleanField]
      return cleanField
    })
  }
  return next()
})

const traffic = new TrafficControl()

app.use(async (ctx, next) => {
  try {
    if (ctx.request.type === 'application/coffee-pot-command') {
      throw new ImATeapotAPIError({})
    }

    await Authentication.authenticate({ connection: ctx })

    const representing = ctx.get('x-representing')
    if (representing) {
      await Authentication.authenticateRepresenting({ ctx, representing })
    }

    const rateLimit = traffic.validateRateLimit({ connection: ctx })
    ctx.state.traffic = rateLimit
    ctx.set('X-API-Version', packageInfo.version)
    ctx.set('X-Rate-Limit-Limit', rateLimit.total)
    ctx.set('X-Rate-Limit-Remaining', rateLimit.remaining)
    ctx.set('X-Rate-Limit-Reset', rateLimit.reset)

    logger.info({
      GELF: true,
      _event: 'request',
      _ip: ctx.request.ip,
      _headers: ctx.request.headers,
      _path: ctx.request.path,
      _query: ctx.query,
      _method: ctx.request.req.method,
    }, `Request by ${ctx.request.ip} to ${ctx.request.path}`)


    if (rateLimit.exceeded) {
      throw new TooManyRequestsAPIError({})
    }

    if (ctx.state.client) {
      ctx.state.user = ctx.state.client
    }

    ctx.state.permissions = Permission.getConnectionPermissions({ connection: ctx })

    if (ctx.get('X-Permanent-Deletion')) {
      const basicUser = await Authentication.basicUserAuthentication({ connection: ctx })
      if (basicUser.id !== ctx.state.user.id) {
        throw new UnauthorizedAPIError({})
      }

      if (Permission.granted({ connection: ctx, permissions: ['resources.forcedelete'] })) {
        ctx.state.forceDelete = true
      } else {
        throw new ForbiddenAPIError({ parameter: 'X-Permanent-Deletion' })
      }
    }

    const result = await next()
    if (result === true) {
      ctx.status = StatusCode.noContent
    } else if (result instanceof Document) {
      ctx.type = 'application/vnd.api+json'
      ctx.body = result.toString()
    } else if (result) {
      ctx.body = result
    } else if (typeof result === 'undefined' && !ctx.body) {
      throw new NotFoundAPIError({})
    } else if (!ctx.body) {
      logger.error({
        GELF: true,
        _event: 'request',
        _ip: ctx.request.ip,
        _headers: ctx.request.headers,
        _path: ctx.request.path,
        _query: ctx.query,
        _method: ctx.request.req.method,
      }, 'Router received a request that could not be processed')

      throw new InternalServerError({})
    }
  } catch (errors) {
    const query = new Query({ connection: ctx })
    const errorDocument = new ErrorDocument({ query, errors })

    ctx.status = errorDocument.httpStatus
    ctx.type = 'application/vnd.api+json'
    ctx.body = errorDocument.toString()
  }
})

// ROUTES
// =============================================================================

const endpoints = Object.values(routes).map((Route) => {
  return new Route()
})

// OAUTH2

const [transactionLoader, decision] = oauth2.server.decision()

router.post(
  '/oauth2/authorize',
  Authentication.isAuthenticated,
  transactionLoader,
  decision,
  oauth2.authorizationDecisionHandler,
)

router.post('/oauth2/token',
  Authentication.isClientAuthenticated,
  oauth2.server.token(),
  oauth2.server.errorHandler())


app.use(router.routes())
app.use(router.allowedMethods({
  throw: true,
}))



const server = http.createServer(app.callback())
server.wss = new WebSocket({ server, trafficManager: traffic })


;(async function startServer () {
  try {
    await db.sync()
    const listen = promisify(server.listen.bind(server))
    await listen(config.server.port, config.server.hostname)
    logger.info({
      GELF: true,
      _event: 'startup',
    }, `HTTP Server listening on ${config.server.hostname} port ${config.server.port}`)
  } catch (error) {
    logger.fatal({
      GELF: true,
      _event: 'error',
      _message: error.message,
      _stack: error.stack,
    })
  }
}())

export default endpoints
