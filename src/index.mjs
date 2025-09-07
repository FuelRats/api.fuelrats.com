import http from 'http'
import Koa from 'koa'
import koaBody from 'koa-body'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import querystring from 'koa-qs'
import session from 'koa-session'
import npid from 'npid'
import { promisify } from 'util'
import {
  TooManyRequestsAPIError,
  ImATeapotAPIError,
  InternalServerError,
  NotFoundAPIError,
  ForbiddenAPIError,
  UnauthorizedAPIError,
} from './classes/APIError'
import Authentication from './classes/Authentication'
import { OAuthError } from './classes/OAuthError'
import Permission from './classes/Permission'
import router from './classes/Router'
import StatusCode from './classes/StatusCode'
import TrafficControl from './classes/TrafficControl'
import WebSocket from './classes/WebSocket'
import config from './config'
import { db } from './db'
import Document from './Documents/Document'
import ErrorDocument from './Documents/ErrorDocument'
import packageInfo from './files/package'
import logger, { logError, logMetric } from './logging'
import { addDatabaseMetrics } from './middleware/DatabaseMetrics'
import Query from './query'
import * as routes from './routes'


const app = new Koa()
querystring(app)


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
  jsonStrict: false,
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
  ctx.state.fingerprint = ctx.request.headers['x-fingerprint']

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

/**
 * Setup authentication and rate limiting
 * @param {object} ctx - Koa context object
 */
async function setupAuthentication (ctx) {
  if (ctx.request.type === 'application/coffee-pot-command') {
    throw new ImATeapotAPIError({})
  }

  await Authentication.authenticate({ connection: ctx })

  const rateLimit = traffic.validateRateLimit({ connection: ctx })
  ctx.state.traffic = rateLimit
  ctx.set('X-API-Version', packageInfo.version)
  ctx.set('X-Rate-Limit-Limit', rateLimit.total)
  ctx.set('X-Rate-Limit-Remaining', rateLimit.remaining)
  ctx.set('X-Rate-Limit-Reset', rateLimit.reset)

  if (rateLimit.exceeded) {
    throw new TooManyRequestsAPIError({})
  }

  if (ctx.state.client) {
    ctx.state.user = ctx.state.client
  }

  ctx.state.permissions = Permission.getConnectionPermissions({ connection: ctx })
}

/**
 * Handle representing header authentication
 * @param {object} ctx - Koa context object
 */
async function handleRepresenting (ctx) {
  const representing = ctx.get('x-representing')
  if (representing) {
    if (await Authentication.authenticateRepresenting({ ctx, representing }) === false) {
      throw new UnauthorizedAPIError({
        parameter: 'representing',
      })
    }
    ctx.state.permissions = Permission.getConnectionPermissions({ connection: ctx })
  }
}

/**
 * Handle permanent deletion authorization
 * @param {object} ctx - Koa context object
 */
async function handlePermanentDeletion (ctx) {
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
}

/**
 * Handle response formatting based on result type
 * @param {object} ctx - Koa context object
 * @param {*} result - The result from the route handler
 */
function handleResponse (ctx, result) {
  if (result === true) {
    ctx.status = StatusCode.noContent
  } else if (result instanceof Document) {
    ctx.type = 'application/vnd.api+json'
    ctx.body = result.toString()
  } else if (result) {
    ctx.response.body = result
  } else if (typeof result === 'undefined' && !ctx.response.body) {
    throw new NotFoundAPIError({})
  } else if (!ctx.response.body) {
    logError(new Error('Unprocessable request'), {
      _ip: ctx.request.ip,
      _path: ctx.request.path,
      _method: ctx.request.req.method,
    }, 'Router received a request that could not be processed')

    throw new InternalServerError({})
  }
}

/**
 * Log metrics for successful HTTP responses
 * @param {object} ctx - Koa context object
 * @param {number} startTime - Request start timestamp
 */
function logSuccessMetrics (ctx, startTime) {
  const responseTime = Date.now() - startTime
  logMetric('http_response', {
    _ip: ctx.request.ip,
    _path: ctx.request.path,
    _method: ctx.request.req.method,
    _status_code: ctx.status,
    _response_time_ms: responseTime,
    _response_size: ctx.response.length || 0,
    _user_id: ctx.state.user?.id,
    _client_id: ctx.state.client?.id,
    _rate_limit_remaining: ctx.state.traffic?.remaining,
    _authenticated: Boolean(ctx.state.user),
  }, `${ctx.request.method} ${ctx.request.path} ${ctx.status} ${responseTime}ms`)
}

/**
 * Handle error responses and logging
 * @param {object} ctx - Koa context object
 * @param {Error} errors - The error that occurred
 * @param {number} startTime - Request start timestamp
 */
function handleErrorResponse (ctx, errors, startTime) {
  // Log non-API errors for debugging while keeping API errors clean
  if (!(errors.constructor.name.includes('APIError')) && !(errors instanceof OAuthError)) {
    const errorId = logError(errors, {
      _ip: ctx.request.ip,
      _path: ctx.request.path,
      _method: ctx.request.req.method,
      _user_id: ctx.state.user?.id,
    }, 'Unhandled error in request processing')

    // Add error ID to response for debugging
    ctx.set('X-Error-ID', errorId)
  }

  const responseTime = Date.now() - startTime

  if (errors instanceof OAuthError) {
    ctx.status = StatusCode.badRequest
    ctx.type = 'application/json'
    ctx.body = errors.toString()

    // Log OAuth error metrics
    logMetric('oauth_error', {
      _ip: ctx.request.ip,
      _path: ctx.request.path,
      _method: ctx.request.req.method,
      _error_type: 'oauth_error',
      _response_time_ms: responseTime,
    }, `OAuth error: ${errors.message}`)
    return
  }

  const query = new Query({ connection: ctx, validate: false })
  const errorDocument = new ErrorDocument({ query, errors })

  ctx.status = errorDocument.httpStatus
  ctx.type = 'application/vnd.api+json'
  ctx.body = errorDocument.toString()

  // Log error response metrics
  logMetric('http_error', {
    _ip: ctx.request.ip,
    _path: ctx.request.path,
    _method: ctx.request.req.method,
    _status_code: ctx.status,
    _response_time_ms: responseTime,
    _error_type: errors.constructor.name,
    _user_id: ctx.state.user?.id,
    _client_id: ctx.state.client?.id,
    _authenticated: Boolean(ctx.state.user),
  }, `Error response: ${ctx.request.method} ${ctx.request.path} ${ctx.status} ${responseTime}ms`)
}

app.use(async (ctx, next) => {
  const startTime = Date.now()

  try {
    await setupAuthentication(ctx)
    await handleRepresenting(ctx)
    await handlePermanentDeletion(ctx)

    const result = await next()
    handleResponse(ctx, result)
    logSuccessMetrics(ctx, startTime)
  } catch (errors) {
    handleErrorResponse(ctx, errors, startTime)
  }
})

// ROUTES
// =============================================================================

const endpoints = Object.values(routes).map((Route) => {
  return new Route()
})


app.use(router.routes())
app.use(router.allowedMethods({
  throw: true,
}))



const server = http.createServer(app.callback())
server.wss = new WebSocket({ server, trafficManager: traffic })


logger.info({
  GELF: true,
  _event: 'startup',
}, 'Starting HTTP Server...')

; (async function startServer () {
  try {
    // Add database metrics before sync
    addDatabaseMetrics(db)

    await db.sync()
    const listen = promisify(server.listen.bind(server))
    await listen(config.server.port, config.server.hostname)
    logger.info({
      GELF: true,
      _event: 'startup',
    }, `HTTP Server listening on ${config.server.hostname} port ${config.server.port}`)
  } catch (error) {
    logError(error, { _event: 'startup' }, 'Failed to start server')
    process.exit(1)
  }
}())

export default endpoints
