'use strict'

// IMPORT
// =============================================================================
const Koa = require('koa')
const session = require('koa-session')
const router = require('koa-router')()
const app = new Koa()
require('koa-qs')(app)
const koaBody = require('koa-body')()
const TrafficControl = require('./api/TrafficControl')
const render = require('koa-ejs')
const path = require('path')
const http = require('http')
const ws = require('ws')
const { URL } = require('url')
const logger = require('./api/logger')

const fs = require('fs')
const Permission = require('./api/permission')
const uid = require('uid-safe')
const npid = require('npid')

// Import config
const config = require('./config-example')

if (fs.existsSync('./config.json')) {
  Object.assign(config, require('./config'))
}

const Error = require('./api/errors')


// Import controllers
const Authentication = require('./api/controllers/auth')
const change_password = require('./api/controllers/change_password')
const client = require('./api/controllers/client')
const decal = require('./api/controllers/decal')
const irc = require('./api/controllers/irc').HTTP
const leaderboard = require('./api/controllers/leaderboard')
const login = require('./api/controllers/login')
const ssologin = require('./api/controllers/ssologin')
const logout = require('./api/controllers/logout')
const news = require('./api/controllers/news')
const nicknames = require('./api/controllers/nicknames')
const oauth2 = require('./api/controllers/oauth2')
const profile = require('./api/controllers/profile')
const rat = require('./api/controllers/rat')
const register = require('./api/controllers/register')
const reset = require('./api/controllers/reset')
const rescue = require('./api/controllers/rescue')
const ship = require('./api/controllers/ship')
const statistics = require('./api/controllers/statistics')
const user = require('./api/controllers/user')
const version = require('./api/controllers/version')
const WebSocketManager = require('./api/websocket')
const jiraDrill = require('./api/controllers/jira/drill').HTTP
const { AnopeWebhook } = require('./api/controllers/anope-webhook')


try {
  npid.remove('api.pid')
  let pid = npid.create('api.pid')
  pid.removeOnExit()
} catch (err) {
  process.exit(1)
}

app.keys = ['hunter2']

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
app.use(koaBody)

let port = config.port || process.env.PORT

app.use(async function (ctx, next) {
  ctx.data = ctx.request.body
  ctx.meta = WebSocketManager.meta
  ctx.requireFields = WebSocketManager.requireFields
  ctx.client = {}

  let query = Object.assign(ctx.query, ctx.params)
  ctx.query = parseQuery(query)

  ctx.inet = ctx.request.req.headers['x-forwarded-for'] || ctx.request.ip
  await next()
})

app.use(async function (ctx, next) {
  if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
    ['id', 'createdAt', 'updatedAt', 'deletedAt'].map((cleanField) => {
      ctx.data[cleanField] = undefined
    })
  }
  await next()
})

app.use(Authentication.authenticate)

const traffic = new TrafficControl()

app.use(async (ctx, next) => {
  try {
    let rateLimit = traffic.validateRateLimit(ctx)

    ctx.set('X-API-Version', '2.0')
    ctx.set('X-Rate-Limit-Limit', rateLimit.total)
    ctx.set('X-Rate-Limit-Remaining', rateLimit.remaining)
    ctx.set('X-Rate-Limit-Reset', traffic.nextResetDate)

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
      return next(Error.template('rate_limit_exceeded'))
    }

    let result = await next()
    if (result === true) {
      ctx.status = 204
    } else if (result) {
      ctx.body = result
    }
  } catch (ex) {
    let error = ex
    if (!error.code) {
      error = Error.template('server_error', error)
    }
    ctx.body = {
      errors: [error]
    }

    ctx.status = error.code
    if (error.code === 500) {
      logger.error(error)
      ctx.app.emit('error', ex, ctx)
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
router.get('/rescues', Authentication.isAuthenticated, Permission.required(['rescue.read']), rescue.search)
router.get('/rescues/:id', Authentication.isAuthenticated, Permission.required(['rescue.read']), rescue.findById)
router.post('/rescues', Authentication.isAuthenticated, Permission.required(['rescue.write']), rescue.create)
router.put('/rescues/:id', Authentication.isAuthenticated, rescue.update)
router.put('/rescues/assign/:id', Authentication.isAuthenticated, rescue.assign)
router.put('/rescues/unassign/:id', Authentication.isAuthenticated, rescue.unassign)
router.delete('/rescues/:id', Authentication.isAuthenticated, Permission.required(['rescue.delete']), rescue.delete)


router.get('/clients', Authentication.isAuthenticated, Permission.required(['client.read']), client.search)
router.get('/clients/:id', Authentication.isAuthenticated, client.findById)
router.post('/clients', Authentication.isAuthenticated, client.create)
router.put('/clients/:id', Authentication.isAuthenticated, client.update)
router.delete('/clients/:id', Authentication.isAuthenticated, Permission.required(['client.delete']), client.delete)


router.get('/users', Authentication.isAuthenticated, Permission.required(['user.read']), user.search)
router.get('/users/:id', Authentication.isAuthenticated, user.findById)
router.post('/users', Authentication.isAuthenticated, user.create)
router.put('/users/:id', Authentication.isAuthenticated, user.update)
router.put('/users/:id/updatevirtualhost', Authentication.isAuthenticated,
  Permission.required(['user.write']), user.updatevirtualhost)
router.delete('/users/:id', Authentication.isAuthenticated, Permission.required(['user.delete']), user.delete)

router.get('/nicknames/info/:nickname', Authentication.isAuthenticated, nicknames.info)
router.get('/nicknames/:nickname', Authentication.isAuthenticated, nicknames.search)
router.post('/nicknames', Authentication.isAuthenticated, nicknames.register)
router.put('/nicknames', Authentication.isAuthenticated, nicknames.connect)
router.delete('/nicknames/:nickname', Authentication.isAuthenticated, nicknames.delete)


router.get('/rats', rat.search)
router.get('/rats/:id', rat.findById)
router.post('/rats', rat.create)
router.put('/rats/:id', rat.update)
router.delete('/rats/:id', Permission.required(['rat.delete']), rat.delete)

router.get('/ships', ship.search)
router.get('/ships/:id', ship.findById)
router.post('/ships', fields('name', 'shipType', 'ratId'), clean('shipId'), ship.create)
// router.put('/rats/:id', rat.update)
// router.delete('/rats/:id', Permission.required(['rat.delete']), rat.delete)


router.get('/login',login.display)
router.post('/login',login.login)
router.get('/profile', Authentication.isAuthenticated, Permission.required(['user.read.me']), profile.read)

router.post('/anope', Authentication.isWhitelisted, AnopeWebhook.update)

router.get('/oauth2/authorize',
  Authentication.isAuthenticatedRedirect,
  oauth2.authorizationValidateFields,
  oauth2.authorizationValidateRedirect,
  oauth2.authorizationRender
)

router.post('/oauth2/authorize', Authentication.isAuthenticated, ...oauth2.server.decision())

// Create endpoint handlers for oauth2 token
router.post('/oauth2/token',
  Authentication.isClientAuthenticated,
  oauth2.server.token(),
  oauth2.server.errorHandler())

router.post('/oauth2/revoke', Authentication.isClientAuthenticated, oauth2.revoke)

router.get('/statistics/rescues', statistics.rescues)
router.get('/statistics/systems', statistics.systems)
router.get('/statistics/rats', statistics.rats)

router.get('/version', version.read)
router.post('/reset', reset.requestReset)
router.get('/reset/:token', reset.validateReset)
router.post('/reset/:token', reset.resetPassword)

/*

router.post('/register', register.post)

router.get('/news', API.route(news.list))

router.get('/logout', logout.post)
router.post('/logout', logout.post)


router.get('/decals/check', auth.isAuthenticated(false), decal.check)
router.get('/decals/redeem', auth.isAuthenticated(false), decal.redeem)


router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)


router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)
router.post('/irc/message', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.message)
router.post('/irc/action', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.action)

 */


app.use(router.routes())
app.use(router.allowedMethods())


function parseQuery (query) {
  let queryObj = {}

  // Iterate over each individual query item
  for (let key of Object.keys(query)) {
    // Split them into period delimited arrays
    let keys = key.split('.')
    let target = queryObj

    // Iterate over the period delimited arrays to construct a nested hierarchy
    for (let keyPair of keys.entries()) {
      let subkey = keyPair[1]
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

wss.on('connection', async function connection (client) {
  let url = new URL(`http://localhost:8080${client.upgradeReq.url}`)
  client.clientId = uid.sync(16)
  client.subscriptions = []

  let bearer = url.searchParams.get('bearer')
  if (bearer) {
    let { user, scope } = await Authentication.bearerAuthenticate(bearer)
    if (user) {
      client.user = user
      client.scope = scope
    }
  }

  client.on('message', (message) => {
    try {
      client.websocket = wss
      let request = JSON.parse(message)
      websocketManager.onMessage(client, request)
    } catch (ex) {
      console.log(ex)
    }
  })
})

server.listen(port, config.hostname, (error) => {
  if (error) {

  }
  logger.info(`HTTP Server listening on ${config.hostname} port ${port}`)
})

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

function fields (...requiredFields) {
  return async function (ctx, next) {

    let missingFields = requiredFields.filter((requiredField) => {
      return ctx.data.hasOwnProperty(requiredField) === false
    })
    if (missingFields.length > 0) {
      throw Error.template('missing_required_fields', missingFields)
    }
    await next()
  }
}

function clean (...cleanFields) {
  return async function (ctx, next) {
    if (Array.isArray(ctx.data) || typeof ctx.data === 'object') {
      cleanFields.map((cleanField) => {
        ctx.data[cleanField] = undefined
      })
    }
    await next()
  }
}