'use strict'

// IMPORT
// =============================================================================
require('./globals')
const Koa = require('koa')
const session = require('koa-session')
const router = require('koa-router')()
const app = new Koa()
require('koa-qs')(app)
const koaBody = require('koa-body')
const TrafficControl = require('./TrafficControl')
const render = require('koa-ejs')
const path = require('path')
const http = require('http')
const ws = require('ws')
const { URL } = require('url')
const logger = require('./logger')
const { promisify } = require('util')
const {
  APIError,
  InternalServerError,
  TooManyRequestsAPIError,
  BadRequestAPIError
} = require('./APIError')

const Permission = require('./permission')
const uid = require('uid-safe')
const npid = require('npid')

// Import config
const config = require('../../config')


// Import controllers
const Authentication = require('./controllers/auth')
const client = new (require('./controllers/client'))()
const decal = new (require('./controllers/decal'))()
const login = new (require('./controllers/login'))()
const nicknames = new (require('./controllers/nicknames'))()
const oauth2 = require('./controllers/oauth2')
const profile = new (require('./controllers/profile'))()
const rat = new (require('./controllers/rat'))()
const register = new (require('./controllers/register'))()
const reset = new (require('./controllers/reset'))()
const rescue = new (require('./controllers/rescue'))()
const ship = new (require('./controllers/ship'))()
const statistics = new (require('./controllers/statistics'))()
const user = new (require('./controllers/user'))()
const version = new (require('./controllers/version'))()
const WebSocketManager = require('./websocket')
const jiraDrill = require('./controllers/jira/drill')
const { AnopeWebhook } = require('./controllers/anope-webhook')
const { db } = require('./db/index')

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

app.use(session(sessionConfiguration, app))
app.use(require('koa-static')('static', {
  hidden: false,
  gzip: true
}))
app.use(koaBody())

let port = config.port || process.env.PORT

app.use(async function (ctx, next) {
  ctx.data = ctx.request.body
  ctx.meta = WebSocketManager.meta
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
    ['id', 'createdAt', 'updatedAt', 'deletedAt'].map((cleanField) => {
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
      return next(new TooManyRequestsAPIError({}))
    }

    let result = await next()
    if (result === true) {
      ctx.status = 204
    } else if (result) {
      ctx.body = result
    }
  } catch (ex) {
    let error = ex

    if ((error instanceof APIError) === false) {
      error = new InternalServerError({})
    }
    ctx.status = error.code
    ctx.body = {
      errors: [error]
    }
  }
}) 

render(app, {
  root: path.join(__dirname, 'views'),
  layout: false,
  viewExt: 'html',
  cache: false,
  debug: true
})

// ROUTES
// =============================================================================

// RESCUES
router.get('/rescues',
  Authentication.isAuthenticated,
  Permission.required(['rescue.read']),
  rescue.search)

router.get('/rescues/:id',
  Authentication.isAuthenticated,
  Permission.required(['rescue.read']),
  params('id'),
  rescue.findById)

router.post('/rescues',
  Authentication.isAuthenticated,
  Permission.required(['rescue.write']),
  rescue.create)

router.put('/rescues/:id',
  Authentication.isAuthenticated,
  params('id'),
  rescue.update)

router.put('/rescues/assign/:id',
  Authentication.isAuthenticated,
  params('id'),
  rescue.assign)

router.put('/rescues/addquote/:id',
  Authentication.isAuthenticated,
  params('id'),
  rescue.assign)

router.put('/rescues/unassign/:id',
  Authentication.isAuthenticated,
  params('id'),
  rescue.unassign)

router.delete('/rescues/:id',
  Authentication.isAuthenticated,
  Permission.required(['rescue.delete']),
  params('id'),
  rescue.delete)


// CLIENTS
router.get('/clients',
  Authentication.isAuthenticated,
  Permission.required(['client.read']),
  client.search)

router.get('/clients/:id',
  Authentication.isAuthenticated,
  params('id'),
  client.findById)

router.post('/clients',
  Authentication.isAuthenticated,
  client.create)

router.put('/clients/:id',
  Authentication.isAuthenticated,
  params('id'),
  client.update)

router.delete('/clients/:id',
  Authentication.isAuthenticated,
  Permission.required(['client.delete']),
  params('id'),
  client.delete)


// USERS
router.get('/users',
  Authentication.isAuthenticated,
  Permission.required(['user.read']),
  user.search)

router.get('/users/:id',
  Authentication.isAuthenticated,
  params('id'),
  user.findById)

router.get('/users/image/:id',
  params('id'),
  user.image)

router.post('/users',
  Authentication.isAuthenticated,
  user.create)

router.put('/users/setpassword',
  Authentication.isAuthenticated,
  fields('password', 'new'),
  user.setpassword)

router.post('/users/image/:id',
  Authentication.isAuthenticated,
  user.setimage)
router.put('/users/:id/updatevirtualhost',
  Authentication.isAuthenticated,
  Permission.required(['user.write']),
  params('id'),
  user.updatevirtualhost)

router.put('/users/:id',
  clean('image', 'password'),
  Authentication.isAuthenticated,
  params('id'),
  user.update)

router.delete('/users/:id',
  Authentication.isAuthenticated,
  Permission.required(['user.delete']),
  params('id'),
  user.delete)

router.get('/nicknames/info/:nickname',
  Authentication.isAuthenticated,
  params('nickname'),
  nicknames.info)

router.get('/nicknames/:nickname',
  Authentication.isAuthenticated,
  params('nickname'),
  nicknames.search)

router.post('/nicknames',
  Authentication.isAuthenticated,
  nicknames.register)

router.put('/nicknames',
  Authentication.isAuthenticated,
  nicknames.connect)

router.delete('/nicknames/:nickname',
  Authentication.isAuthenticated,
  params('nickname'),
  nicknames.delete)


// RATS
router.get('/rats',
  rat.search)

router.get('/rats/:id',
  params('id'),
  rat.findById)

router.post('/rats',
  rat.create)

router.put('/rats/:id',
  params('id'),
  rat.update)

router.delete('/rats/:id',
  Permission.required(['rat.delete']),
  params('id'),
  rat.delete)


// SHIPS
router.get('/ships',
  ship.search)

router.get('/ships/:id',
  params('id'),
  ship.findById)

router.post('/ships',
  fields('name', 'shipType', 'ratId'),
  clean('shipId'),
  ship.create)

router.put('/ships/:id',
  clean('shipId'),
  params('id'),
  ship.update)

router.delete('/ships/:id',
  params('id'),
  rat.delete)


// WELCOME
router.get('/welcome', (ctx) => {
  ctx.redirect('https://fuelrats.com/profile')
  ctx.status = 301
})

// LOGIN
router.post('/login',
  fields('email', 'password'),
  login.login)

// REGISTER
router.post('/register',
  fields('email', 'password', 'name', 'platform', 'nickname'),
  register.create)

// PROFILE
router.get('/profile',
  Authentication.isAuthenticated, Permission.required(['user.read.me']),
  profile.read)

// ANOPE
router.post('/anope',
  Authentication.isWhitelisted,
  AnopeWebhook.update)

// OAUTH2
router.get('/oauth2/authorize',
  Authentication.isAuthenticated,
  oauth2.authorizationValidateRedirect,
  oauth2.authorizationRender
)

router.post('/oauth2/authorize',
  Authentication.isAuthenticated,
  ...oauth2.server.decision())

router.post('/oauth2/token',
  Authentication.isClientAuthenticated,
  oauth2.server.token(),
  oauth2.server.errorHandler())

router.post('/oauth2/revoke',
  Authentication.isClientAuthenticated,
  oauth2.revoke)
router.post('/oauth2/revokeall',
  Authentication.isClientAuthenticated,
  oauth2.revokeAll)


// STATISTICS
router.get('/statistics/rescues',
  statistics.rescues)

router.get('/statistics/systems',
  statistics.systems)

router.get('/statistics/rats',
  statistics.rats)


// VERSION
router.get('/version', version.read)


// RESET
router.post('/reset',
  fields('email'),
  reset.requestReset)

router.get('/reset/:token',
  params('token'),
  reset.validateReset)

router.post('/reset/:token',
  params('token'),
  fields('password'),
  reset.resetPassword)


// DECALS
router.get('/decals/check',
  Authentication.isAuthenticated,
  decal.check)

router.get('/decals/redeem',
  Authentication.isAuthenticated,
  decal.redeem)


// JIRA
router.post('/jira/drill',
  Authentication.isAuthenticated,
  Permission.required(['user.write']),
  jiraDrill.update)


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

        target[subkey] = query[key]
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
const wss = new ws.Server({ server })

const websocketManager = new WebSocketManager(wss, traffic)

wss.on('connection', async function connection (client, req) {
  let url = new URL(`http://localhost:8082${req.url}`)
  client.req = req
  client.clientId = uid.sync(GLOBAL.WEBSOCKET_IDENTIFIER_ROUNDS)
  client.subscriptions = []

  let bearer = url.searchParams.get('bearer')
  if (bearer) {
    let { user, scope } = await Authentication.bearerAuthenticate(bearer)
    if (user) {
      client.user = user
      client.scope = scope
    }
  }

  websocketManager.onConnection(client)

  client.on('message', (message) => {
    client.websocket = wss
    try {
      let request = JSON.parse(message)
      websocketManager.onMessage(client, request)
    } catch (ex) {
      logger.info('Failed to parse incoming websocket message')
    }
  })
})

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

/**
 * Makes sure the request object has the required data fields specified
 * @param requiredFields The data fields to require
 * @returns {Function} A promise
 */
function fields (...requiredFields) {
  return function (ctx, next) {
    let missingFields = requiredFields.filter((requiredField) => {
      return ctx.data.hasOwnProperty(requiredField) === false
    })
    if (missingFields.length > 0) {
      throw missingFields.map((field) => {
        return new BadRequestAPIError({ pointer: `/data/attributes/${field}` })
      })
    }
    return next()
  }
}

/**
 * Makes sure the request object has the required params specified
 * @param requiredFields The data fields to require
 * @returns {Function} A promise
 */
function params (...requiredFields) {
  return function (ctx, next) {
    let missingFields = requiredFields.filter((requiredField) => {
      return ctx.query.hasOwnProperty(requiredField) === false
    })
    if (missingFields.length > 0) {
      throw missingFields.map((field) => {
        return new BadRequestAPIError({ parameter: field })
      })
    }
    return next()
  }
}

/**
 * Removes the specified data fields from the request object
 * @param cleanFields The data fields to clean away
 * @returns {Function} A promise
 */
function clean (...cleanFields) {
  return function (ctx, next) {
    if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
      cleanFields.map((cleanField) => {
        ctx.data[cleanField] = undefined
      })
    }
    return next()
  }
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