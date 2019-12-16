import Koa from 'koa'
import session from 'koa-session'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import router from './classes/Router'
import koaBody from 'koa-body'
import TrafficControl from './classes/TrafficControl'
import http from 'http'
import Document from './Documents/Document'
import { promisify } from 'util'
import Authentication from './classes/Authentication'
import oauth2 from './routes/OAuth2'
import querystring from 'koa-qs'
import WebSocket from './classes/WebSocket'
import { db } from './db'
import npid from 'npid'
import config from '../config'
import logger from './logging'
import Rescue from './routes/Rescues'
import User from './routes/Users'
import Rats from './routes/Rats'
import Clients from './routes/Clients'
import Frontier from './routes/Frontier'
import Ships from './routes/Ships'
import Register from './routes/Register'
import Reset from './routes/Resets'
import Nicknames from './routes/Nicknames'
import Verifications from './routes/Verifications'
import Sessions from './routes/Sessions'
import Statistics from './routes/Statistics'
import Version from './routes/Version'
import Decals from './routes/Decals'
import Stream from './routes/Stream'
import JiraDrillWebhook from './routes/JiraDrillWebhook'
import Permission from './classes/Permission'
import packageInfo from '../package'
import ErrorDocument from './Documents/ErrorDocument'
import Query from './query'
import StatusCode from './classes/StatusCode'



const app = new Koa()
querystring(app)

const {
  TooManyRequestsAPIError
} = require('./classes/APIError')



// Import controllers

global.WEBSOCKET_IDENTIFIER_ROUNDS = 16
global.BCRYPT_ROUNDS_COUNT = 16
global.OAUTH_CODE_LENGTH = 24
global.OAUTH_TOKEN_LENTH = 32
global.OVERSEER_CHANNEL = '#doersofstuff'
global.RESCUE_CHANNEL = '#fuelrats'
global.PAPERWORK_CHANNEL = '#ratchat'
global.MODERATOR_CHANNEL = '#rat-ops'
global.TECHNICAL_CHANNEL = '#rattech'
global.RESET_TOKEN_LENGTH = 32

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
  signed: true
}

app.use(conditional())
app.use(etag())
app.use(session(sessionConfiguration, app))
app.use(koaBody({
  strict: false,
  multipart: true
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
    await Authentication.authenticate({ connection: ctx })

    const rateLimit = traffic.validateRateLimit({ connection: ctx })
    ctx.state.traffic = rateLimit

    ctx.set('X-API-Version', packageInfo.version)
    ctx.set('X-Rate-Limit-Limit', rateLimit.total)
    ctx.set('X-Rate-Limit-Remaining', rateLimit.remaining)
    ctx.set('X-Rate-Limit-Reset', rateLimit.reset)

    logger.info({ tags: ['request'] }, `Request by ${ctx.request.ip} to ${ctx.request.path}`, {
      ip: ctx.request.ip,
      headers: ctx.request.headers,
      path: ctx.request.path,
      rateLimitTotal: rateLimit.total,
      rateLimitRemaining: rateLimit.remaining,
      query: ctx.query,
      method: ctx.request.req.method
    })

    if (rateLimit.exceeded) {
      // noinspection ExceptionCaughtLocallyJS
      throw new TooManyRequestsAPIError({})
    }

    if (ctx.state.client) {
      ctx.state.user = ctx.state.client
    }

    ctx.state.permissions = Permission.getConnectionPermissions({ connection: ctx })

    const result = await next()
    if (result === true) {
      ctx.status = StatusCode.noContent
    } else if (result instanceof Document) {
      ctx.type = 'application/vnd.api+json'
      ctx.body = result.toString()
    } else if (result) {
      ctx.body = result
    } else {
      logger.error('Router received a response from the endpoint that could not be processed')
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

const routes = [
  new Rescue(),
  new User(),
  new Nicknames(),
  new Rats(),
  new Clients(),
  new Ships(),
  new Register(),
  new Reset(),
  new Verifications(),
  new Sessions(),
  new Statistics(),
  new Version(),
  new Decals(),
  new Stream(),
  new JiraDrillWebhook(),
  new Frontier()
]

// OAUTH2

const [transactionLoader, decision] = oauth2.server.decision()

router.post(
  '/oauth2/authorize',
  Authentication.isAuthenticated,
  transactionLoader,
  decision,
  oauth2.authorizationDecisionHandler
)

router.post('/oauth2/token',
  Authentication.isClientAuthenticated,
  oauth2.server.token(),
  oauth2.server.errorHandler())


app.use(router.routes())
app.use(router.allowedMethods({
  throw: true
}))



const server = http.createServer(app.callback())
server.wss = new WebSocket({ server, traffic })



;(async function startServer () {
  try {
    await db.sync()
    const listen = promisify(server.listen.bind(server))
    await listen(config.server.port, config.server.hostname)
    logger.info(`HTTP Server listening on ${config.server.hostname} port ${config.server.port}`)
  } catch (error) {
    logger.error(error)
  }
})()

export default routes
