import { Hono } from 'hono'
import { etag } from 'hono/etag'
import npid from 'npid'

import {
  TooManyRequestsAPIError,
  ImATeapotAPIError,
  ForbiddenAPIError,
  UnauthorizedAPIError,
} from './classes/APIError'
import Authentication from './classes/Authentication'
import { OAuthError } from './classes/OAuthError'
import Permission from './classes/Permission'
import { RequestContext } from './classes/RequestContext'
import StatusCode from './classes/StatusCode'
import TrafficControl from './classes/TrafficControl'
import WebSocket from './classes/WebSocket'
import config from './config'
import { db } from './db'
import ErrorDocument from './Documents/ErrorDocument'
import packageInfo from './files/package'
import logger, { logError, logMetric } from './logging'
import { addDatabaseMetrics } from './middleware/DatabaseMetrics'
import { sessionMiddleware } from './middleware/session'
import Query from './query'
import { app as routerApp } from './routes/API'
import * as routes from './routes'

// PID file
try {
  npid.remove('api.pid')
  const pid = npid.create('api.pid')
  pid.removeOnExit()
} catch {
  process.exit(1)
}

const honoApp = new Hono()

// Global error handler — catches any unhandled errors and returns JSONAPI error
honoApp.onError((err, c) => {
  const ctx = new RequestContext({ c, state: {}, session: {} })
  try {
    const query = new Query({ connection: ctx, validate: false })
    const errorDocument = new ErrorDocument({ query, errors: err })
    return new Response(errorDocument.toString(), {
      status: errorDocument.httpStatus,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    })
  } catch {
    return new Response(JSON.stringify({
      errors: [{ status: '500', title: 'Internal Server Error' }],
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    })
  }
})

// ETag + conditional GET
honoApp.use('*', etag())

// Session
honoApp.use('*', sessionMiddleware(config.server.cookieSecret))

// Traffic control
const traffic = new TrafficControl()

// Auth + rate limiting + error handling middleware
honoApp.use('*', async (c, next) => {
  const startTime = Date.now()

  // Build a RequestContext for auth middleware
  const ctx = new RequestContext({
    c,
    state: {},
    session: c.get('session') || {},
  })

  try {
    // Teapot check
    if (ctx.request.type === 'application/coffee-pot-command') {
      throw new ImATeapotAPIError({})
    }

    // Authentication
    await Authentication.authenticate({ connection: ctx })

    // Rate limiting
    const rateLimit = traffic.validateRateLimit({ connection: ctx })
    ctx.state.traffic = rateLimit
    c.header('X-API-Version', packageInfo.version)
    c.header('X-Rate-Limit-Limit', String(rateLimit.total))
    c.header('X-Rate-Limit-Remaining', String(rateLimit.remaining))
    c.header('X-Rate-Limit-Reset', String(rateLimit.reset))

    if (rateLimit.exceeded) {
      throw new TooManyRequestsAPIError({})
    }

    if (ctx.state.client) {
      ctx.state.user = ctx.state.client
    }

    ctx.state.permissions = Permission.getConnectionPermissions({ connection: ctx })

    // Handle representing header
    const representing = ctx.get('x-representing')
    if (representing) {
      if (await Authentication.authenticateRepresenting({ ctx, representing }) === false) {
        throw new UnauthorizedAPIError({ parameter: 'representing' })
      }
      ctx.state.permissions = Permission.getConnectionPermissions({ connection: ctx })
    }

    // Handle permanent deletion
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

    // Store state for route handlers to pick up via c.get('state')
    c.set('state', ctx.state)
    c.set('session', ctx.session)

    await next()

    // Log success metrics
    const responseTime = Date.now() - startTime
    logMetric('http_response', {
      _ip: ctx.request.ip,
      _path: ctx.request.path,
      _method: ctx.request.method,
      _status_code: c.res?.status || 200,
      _response_time_ms: responseTime,
      _user_id: ctx.state.user?.id,
      _client_id: ctx.state.client?.id,
      _rate_limit_remaining: ctx.state.traffic?.remaining,
      _authenticated: Boolean(ctx.state.user),
    }, `${ctx.request.method} ${ctx.request.path} ${c.res?.status || 200} ${responseTime}ms`)
  } catch (errors) {
    const responseTime = Date.now() - startTime

    // Log non-API errors
    if (!(errors.constructor?.name?.includes('APIError')) && !(errors instanceof OAuthError)) {
      const errorId = logError(errors, {
        _ip: ctx.request.ip,
        _path: ctx.request.path,
        _method: ctx.request.method,
        _user_id: ctx.state.user?.id,
      }, 'Unhandled error in request processing')

      c.header('X-Error-ID', errorId)
    }

    if (errors instanceof OAuthError) {
      logMetric('oauth_error', {
        _ip: ctx.request.ip,
        _path: ctx.request.path,
        _method: ctx.request.method,
        _error_type: 'oauth_error',
        _response_time_ms: responseTime,
      }, `OAuth error: ${errors.message}`)

      return c.json(errors.toString(), StatusCode.badRequest)
    }

    const query = new Query({ connection: ctx, validate: false })
    const errorDocument = new ErrorDocument({ query, errors })

    logMetric('http_error', {
      _ip: ctx.request.ip,
      _path: ctx.request.path,
      _method: ctx.request.method,
      _status_code: errorDocument.httpStatus,
      _response_time_ms: responseTime,
      _error_type: errors.constructor?.name,
      _user_id: ctx.state.user?.id,
      _client_id: ctx.state.client?.id,
      _authenticated: Boolean(ctx.state.user),
    }, `Error response: ${ctx.request.method} ${ctx.request.path} ${errorDocument.httpStatus} ${responseTime}ms`)

    return new Response(errorDocument.toString(), {
      status: errorDocument.httpStatus,
      headers: { 'Content-Type': 'application/vnd.api+json' },
    })
  }
})

// Static routes (previously in Router.mjs)
honoApp.get('/', (c) => {
  const configuration = {
    theme: 'purple',
    layout: 'modern',
    showSidebar: true,
    hideDownloadButton: false,
    searchHotKey: 'k',
    darkMode: false,
    authentication: {
      preferredSecurityScheme: 'bearerAuth',
    },
  }

  const html = `<!doctype html>
<html>
  <head>
    <title>FuelRats API Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="./openapi/bundled.yaml"
      data-configuration='${JSON.stringify(configuration)}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

  return c.html(html)
})

honoApp.get('/openapi/bundled.yaml', async (c) => {
  const fs = await import('fs/promises')
  const path = await import('path')

  try {
    const bundledPath = path.resolve('docs/openapi/bundled.yaml')
    const bundled = await fs.readFile(bundledPath, 'utf8')
    return new Response(bundled, {
      headers: { 'Content-Type': 'application/x-yaml' },
    })
  } catch {
    return c.json({ error: 'Bundled OpenAPI specification not found' }, 404)
  }
})

honoApp.get('/openapi/openapi.yaml', async (c) => {
  const fs = await import('fs/promises')
  const path = await import('path')

  try {
    const specPath = path.resolve('docs/openapi/openapi.yaml')
    const spec = await fs.readFile(specPath, 'utf8')
    return new Response(spec, {
      headers: { 'Content-Type': 'application/x-yaml' },
    })
  } catch {
    return c.json({ error: 'OpenAPI specification not found' }, 404)
  }
})

honoApp.get('/welcome', (c) => {
  return c.redirect(`${config.frontend.url}/profile`, 301)
})

// Instantiate all route classes — triggers addInitializer which registers routes on routerApp
const endpoints = Object.values(routes).map((Route) => {
  return new Route()
})

// Mount API routes
honoApp.route('/', routerApp)

// Start server
logger.info({
  GELF: true,
  _event: 'startup',
}, 'Starting HTTP Server...')

// Initialise WebSocket manager
const wsManager = new WebSocket({ trafficManager: traffic })

;(async function startServer () {
  try {
    addDatabaseMetrics(db)
    await db.sync()

    Bun.serve({
      port: config.server.port,
      hostname: config.server.hostname,
      fetch (req, server) {
        // Try WebSocket upgrade first
        if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
          if (WebSocket.handleUpgrade(req, server)) {
            return undefined
          }
          return new Response('WebSocket upgrade failed', { status: 400 })
        }
        // Otherwise handle as normal HTTP via Hono
        return honoApp.fetch(req, server)
      },
      websocket: {
        open (ws) { wsManager.onOpen(ws) },
        message (ws, message) { wsManager.onMessage(ws, message) },
        close (ws) { wsManager.onClose(ws) },
      },
    })

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
