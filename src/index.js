import Koa from 'koa'
import session from 'koa-session'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
import router from './classes/Router'
import koaBody from 'koa-body'
import TrafficControl from './classes/TrafficControl'
import http from 'http'
import logger from './loggly/logger'
import Document from './classes/Document'
import { promisify } from 'util'
import Authentication from './classes/Authentication'
import oauth2 from './routes/OAuth2'
import querystring from 'koa-qs'
import WebSocket from './classes/WebSocket'
import { db } from './db'
import npid from 'npid'
import config from '../config'

import Rescue from './routes/Rescues'
import User from './routes/Users'
import Rats from './routes/Rats'
import Clients from './routes/Clients'
import Nicknames from './routes/Nicknames'
import Ships from './routes/Ships'
import Login from './routes/Login'
import Register from './routes/Register'
import Profile from './routes/Profiles'
import Reset from './routes/Resets'
import AnopeWebhook from './routes/AnopeWebhook'
import Statistics from './routes/Statistics'
import Version from './routes/Version'
import Decals from './routes/Decals'
import Stream from './routes/Stream'
import JiraDrillWebhook from './routes/JiraDrillWebhook'
import NPO from './routes/NPO'


const app = new Koa()
querystring(app)

const {
  APIError,
  InternalServerError,
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

app.keys = [config.cookie.secret]

const sessionConfiguration = {
  key: 'fuelrats:session',
  overwrite: true,
  signed: true
}

app.use(conditional())
app.use(etag())
app.use(session(sessionConfiguration, app))
app.use(koaBody({
  strict: false
}))

const port = config.port || process.env.PORT

/**
 * Parses an object of URL query parameters and builds a nested object by delimiting periods into sub objects.
 * @param query an array of URL query parameters
 * @returns {{}} a nested object
 */
function parseQuery (query) {
  return Object.entries(query).reduce((acc, [key, value]) => {
    const [last, ...paths] = key.split('.').reverse()
    const object = paths.reduce((pathAcc, el) => {
      return { [el]: pathAcc }
    }, { [last]: value })
    return {...acc, ...object}
  }, {})
}

/**
 * Goes through an object and sets properties commonly usde to hold sensitive information to a static value.
 * @param obj The object to censor
 * @returns {{}} A censored object
 */
function censor (obj) {
  const censoredObj = {}
  Object.assign(censoredObj, obj)

  if (censoredObj.password) {
    censoredObj.password = '[CENSORED]'
  }
  if (censoredObj.secret) {
    censoredObj.secret = '[CENSORED]'
  }

  return censoredObj
}

app.use((ctx, next) => {
  ctx.data = ctx.request.body
  ctx.client = {}

  const { query } = ctx
  ctx.query = parseQuery(query)

  if (ctx.request.headers['x-forwarded-for']) {
    [ctx.inet] = ctx.request.headers['x-forwarded-for'].split(', ')
  } else {
    ctx.inet =  ctx.request.ip
  }

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
    await Authentication.authenticate({connection: ctx})

    const rateLimit = traffic.validateRateLimit({connection: ctx})

    ctx.set('X-API-Version', '2.0')
    ctx.set('X-Rate-Limit-Limit', rateLimit.total)
    ctx.set('X-Rate-Limit-Remaining', rateLimit.remaining)
    ctx.set('X-Rate-Limit-Reset', rateLimit.nextResetDate)

    logger.info({ tags: ['request'] }, `Request by ${ctx.inet} to ${ctx.request.path}`, {
      'ip': ctx.inet,
      'path': ctx.request.path,
      'rate-limit-limit': rateLimit.total,
      'rate-limit-remaining': rateLimit.remaining,
      'query': ctx.query,
      'body': censor(ctx.data),
      'method': ctx.request.req.method
    })

    if (rateLimit.exceeded) {
      next(new TooManyRequestsAPIError({}))
      return
    }

    if (ctx.state.client) {
      ctx.state.user = ctx.state.client
    }

    const result = await next()
    if (result === true) {
      ctx.status = 204
    } else if (result instanceof Document) {
      ctx.type = 'application/vnd.api+json'
      ctx.body = result.toString()
    } else if (result) {
      ctx.body = result
    }
  } catch (ex) {
    let errors = ex

    if (errors.hasOwnProperty('name')) {
      errors = APIError.fromValidationError(errors)
    }

    if (Array.isArray(errors) === false) {
      errors = [errors]
    }

    errors = errors.map((error) => {
      if ((error instanceof APIError) === false) {
        return new InternalServerError({})
      }
      return error
    })

    ctx.status = errors[0].status
    ctx.body = {
      errors
    }
  }
})

// ROUTES
// =============================================================================

const routes = [
  new Rescue(),
  new User(),
  new Rats(),
  new Clients(),
  new Nicknames(),
  new Ships(),
  new Login(),
  new Register(),
  new Profile(),
  new Reset(),
  new AnopeWebhook(),
  new Statistics(),
  new Version(),
  new Decals(),
  new Stream(),
  new JiraDrillWebhook(),
  new NPO()
]
export default routes

// OAUTH2

router.post('/oauth2/authorize',
  ...oauth2.server.decision())

router.post('/oauth2/token',
  Authentication.isClientAuthenticated,
  oauth2.server.token(),
  oauth2.server.errorHandler())


app.use(router.routes())
app.use(router.allowedMethods())



const server = http.createServer(app.callback())
server.wss = new WebSocket({ server, traffic })



;(async function startServer () {
  try {
    await db.sync()
    const listen = promisify(server.listen.bind(server))
    await listen(port, config.hostname)
    logger.info(`HTTP Server listening on ${config.hostname} port ${port}`)
  } catch (error) {
    logger.error(error)
  }
})()

// allow launch of app from unit tests
module.exports = server
