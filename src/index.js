

// IMPORT
// =============================================================================

import {UnprocessableEntityAPIError} from './classes/APIError'

require('./Globals')
import Koa from 'koa'
import session from 'koa-session'
import conditional from 'koa-conditional-get'
import etag from 'koa-etag'
const app = new Koa()
import querystring from 'koa-qs'
import koaStatic from 'koa-static'
import router from './classes/Router'
querystring(app)
import koaBody from 'koa-body'
import TrafficControl from './classes/TrafficControl'
import render from 'koa-ejs'
import path from 'path'
import http from 'http'
import logger from './loggly/logger'
import { promisify } from 'util'
const {
  APIError,
  InternalServerError,
  TooManyRequestsAPIError
} = require('./classes/APIError')

import npid from 'npid'

// Import config
import config from '../config'


// Import controllers
import Authentication from './classes/Authentication'
import oauth2 from './routes/OAuth2'

import WebSocket from './classes/WebSocket'
import { db } from './db/index'

try {
  npid.remove('api.pid')
  let pid = npid.create('api.pid')
  pid.removeOnExit()
} catch (err) {
  process.exit(1)
}

app.keys = [config.cookie.secret]

let sessionConfiguration = {
  key: 'fuelrats:session',
  overwrite: true,
  signed: true
}

app.use(conditional())
app.use(etag())
app.use(session(sessionConfiguration, app))
app.use(koaStatic('../static', {
  hidden: false,
  gzip: true
}))
app.use(koaBody())

let port = config.port || process.env.PORT

app.use(async function (ctx, next) {
  ctx.data = ctx.request.body
  ctx.client = {}

  let { query } = ctx
  ctx.query = parseQuery(query)

  if (ctx.request.headers['x-forwarded-for']) {
    [ctx.inet] = ctx.request.headers['x-forwarded-for'].split(', ')
  } else {
    ctx.inet =  ctx.request.ip
  }

  await next()
})

app.use(async function (ctx, next) {
  if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
    ['createdAt', 'updatedAt', 'deletedAt', 'revision'].map((cleanField) => {
      delete ctx.data[cleanField]
    })
  }
  await next()
})

const traffic = new TrafficControl()

app.use(async (ctx, next) => {
  try {
    await Authentication.authenticate(ctx)

    let rateLimit = traffic.validateRateLimit(ctx)

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

    let result = await next()
    if (result === true) {
      ctx.status = 204
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

    errors = errors.map(error => {
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

render(app, {
  root: path.join(__dirname, '../views'),
  layout: false,
  viewExt: 'html',
  cache: false,
  debug: true
})

// ROUTES
// =============================================================================

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

export let routes = [
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

// OAUTH2

router.post('/oauth2/authorize',
  ...oauth2.server.decision())

router.post('/oauth2/token',
  Authentication.isClientAuthenticated,
  oauth2.server.token(),
  oauth2.server.errorHandler())


app.use(router.routes())
app.use(router.allowedMethods())

/**
 * Parses an object of URL query parameters and builds a nested object by delimiting periods into sub objects.
 * @param query an array of URL query parameters
 * @returns {{}} a nested object
 */
function parseQuery (query) {
  let queryObj = {}

  // Iterate over each individual query item
  for (let key of Object.keys(query)) {
    // Split them into period delimited arrays
    let keys = key.split('.')
    let target = queryObj

    // Iterate over the period delimited arrays to construct a nested hierarchy
    for (let keyPair of keys.entries()) {
      let [, subkey ] = keyPair
      if (keyPair[0] === keys.length - 1) {
        // We have reached the end of the delimited array which means we can insert the value

        try {
          target[subkey] = JSON.parse(query[key])
        } catch (ex) {
          throw UnprocessableEntityAPIError({ parameter: key })
        }
      } else if (!target[subkey]) {
        /* We have not reached the end of the delimited array so we need to create a nested object unless
        it already exists */
        target[subkey] = {}
        target = target[subkey]
      }
    }
  }
  return queryObj
}

let server = http.createServer(app.callback())
new WebSocket(server, traffic)

/**
 * Goes through an object and sets properties commonly usde to hold sensitive information to a static value.
 * @param obj The object to censor
 * @returns {{}} A censored object
 */
function censor (obj) {
  let censoredObj = {}
  Object.assign(censoredObj, obj)

  if (censoredObj.password) {
    censoredObj.password = '[CENSORED]'
  }
  if (censoredObj.secret) {
    censoredObj.secret = '[CENSORED]'
  }

  return censoredObj
}

(async function startServer () {
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
