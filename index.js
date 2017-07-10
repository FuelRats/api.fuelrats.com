'use strict'

// IMPORT
// =============================================================================
const Koa = require('koa')
const session = require('koa-session')
const cors = require('koa-cors')
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

// Import libraries
const compression = require('compression')
const fs = require('fs')
const Permission = require('./api/permission')
const winston = require('winston')
const uid = require('uid-safe')
const npid = require('npid')
require('winston-daily-rotate-file')

// Import config
const config = require('./config-example')

if (fs.existsSync('./config.json')) {
  Object.assign(config, require('./config'))
}

const API = require('./api/classes/API')
const Error = require('./api/errors')

// Import models
const db = require('./api/db').db
const User = require('./api/db').User
const Rat = require('./api/db').Rat

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
const rat = require('./api/controllers/rat')
const register = require('./api/controllers/register')
const reset = require('./api/controllers/reset')
const rescue = require('./api/controllers/rescue')
const roster = require('./api/controllers/roster').HTTP
const ship = require('./api/controllers/ship').HTTP
const statistics = require('./api/controllers/statistics')
const user = require('./api/controllers/user')
const version = require('./api/controllers/version')
const WebSocketManager = require('./api/websocket')
const jiraDrill = require('./api/controllers/jira/drill').HTTP

db.sync()


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
  ctx.client = {}

  let query = Object.assign(ctx.query, ctx.params)
  ctx.query = parseQuery(query)

  ctx.inet = ctx.request.headers['X-Forwarded-for'] ||
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

    if (rateLimit.exceeded) {
      return next(Error.template('rate_limit_exceeded'))
    }

    let result = await next()
    if (result) {
      ctx.body = result
    } else {
      ctx.status = 204
    }
  } catch (ex) {
    let error = ex
    if (!error.code) {
      error = Error.template('server_error', error.name)
    }
    ctx.body = ex
    ctx.status = error.code
    if (error.code === 500) {
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


router.get('/login',login.display)
router.post('/login',login.login)

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

/* router.post('/rescues', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.create))
router.put('/rescues/:id', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.update))
router.delete('/rescues/:id', API.version('v2.0'), auth.isAuthenticated,
Permission.required(['rescue.delete']), API.route(rescue.delete))
router.put('/rescues/:id/assign', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.assign))
router.put('/rescues/:id/unassign', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.unassign))
router.put('/rescues/:id/addquote', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.addquote))
router.put('/rescues/:id', API.version('v2.0'), API.route(rescue.getById))

router.get('/rats', API.version('v2.0'), API.route(rat.search))
router.post('/rats', API.version('v2.0'), auth.isAuthenticated, API.route(rat.create))
router.put('/rats/:id', API.version('v2.0'), auth.isAuthenticated, API.route(rat.update))
router.delete('/rats/:id', API.version('v2.0'), auth.isAuthenticated,
Permission.required(['rat.delete']), API.route(rat.delete))

router.get('/users', API.version('v2.0'), auth.isAuthenticated, API.route(user.search))
router.post('/users', API.version('v2.0'), auth.isAuthenticated,
Permission.required(['user.write']), API.route(user.create))
router.put('/users/:id', API.version('v2.0'), auth.isAuthenticated, API.route(user.update))
router.delete('/users/:id', API.version('v2.0'), auth.isAuthenticated,
Permission.required(['user.delete']), API.route(user.delete))

router.get('/nicknames/search/:nickname', API.route(nicknames.search))
router.get('/nicknames/:nickname', auth.isAuthenticated, Permission.required(['user.read.me']),
 API.route(nicknames.info))
router.post('/nicknames/', auth.isAuthenticated,
Permission.required(['user.write.me']), API.route(nicknames.register))
router.put('/nicknames/', auth.isAuthenticated, Permission.required(['user.write.me']),
API.route(nicknames.connect))
router.delete('/nicknames/:nickname', auth.isAuthenticated, Permission.required(['user.write.me']),
API.route(nicknames.delete))


router.get('/statistics/rescues', API.version('v2.0'), API.route(statistics.rescues))
router.get('/statistics/systems', API.version('v2.0'), API.route(statistics.systems))


router.post('/register', register.post)

// router.post('/login', passport.authenticate('local'), login.post)
// router.post('/ssologin', passport.authenticate('local'), ssologin.loginWithCredentials)
router.post('/register', register.post)

router.get('/news', API.route(news.list))



router.route('/oauth2/authorise')
  .get(auth.isAuthenticated, oauth2.authorization)
  .post(auth.isAuthenticated, oauth2.decision)

router.route('/oauth2/authorize')
  .get(auth.isAuthenticated, oauth2.authorization)
  .post(auth.isAuthenticated, oauth2.decision)

// Create endpoint handlers for oauth2 token
router.route('/oauth2/token').post(auth.isClientAuthenticated, oauth2.token)
 */
/*

router.post('/reset', reset.post)
router.post('/change_password', change_password.post)

router.get('/logout', logout.post)
router.post('/logout', logout.post)

router.get('/autocomplete', rat.autocomplete)
router.get('/rats', rat.get)
router.post('/rats', rat.post)
router.get('/rats/:id', rat.getById)
router.put('/rats/:id', auth.isAuthenticated(false), rat.put)
router.delete('/rats/:id', auth.isAuthenticated(false), Permission.required('rat.delete', false), rat.delete)

router.get('/rescues', auth.isAuthenticated(false), rescue.get)
router.post('/rescues', auth.isAuthenticated(false), rescue.post)
router.get('/rescues/:id', auth.isAuthenticated(false), rescue.getById)
router.put('/rescues/:id', auth.isAuthenticated(false), rescue.put)
router.put('/rescues/:id/addquote', auth.isAuthenticated(false), rescue.addquote)
router.put('/rescues/:id/assign/:ratId', auth.isAuthenticated(false), rescue.assign)
router.put('/rescues/:id/unassign/:ratId', auth.isAuthenticated(false), rescue.unassign)
router.delete('/rescues/:id', auth.isAuthenticated(false), Permission.required('rescue.delete', false),
rescue.delete)


router.get('/users', auth.isAuthenticated(false), Permission.required('user.read', false), user.get)
router.get('/users/:id/forceUpdateIRCStatus', auth.isAuthenticated(false),
Permission.required('user.update', false), user.getById)
router.get('/users/:id', auth.isAuthenticated(false), Permission.required('user.read', false), user.getById)
router.put('/users/:id', auth.isAuthenticated(false), user.put)
router.post('/users', auth.isAuthenticated(false), user.post)
router.delete('/users/:id', auth.isAuthenticated(false), Permission.required('user.delete', false), user.delete)

router.get('/nicknames/search/:nickname', auth.isAuthenticated(false), nicknames.search)
router.get('/nicknames/:nickname', auth.isAuthenticated(false), Permission.required('self.user.read', false),
nicknames.get)
router.post('/nicknames/', auth.isAuthenticated(false), Permission.required('self.user.update', false),
 nicknames.post)
router.put('/nicknames/', auth.isAuthenticated(false), Permission.required('self.user.update', false),
 nicknames.put)
router.delete('/nicknames/:nickname', auth.isAuthenticated(false), Permission.required('self.user.update', false),
nicknames.delete)

router.get('/clients', auth.isAuthenticated(false), Permission.required('client.read', false), client.get)
router.put('/clients/:id', auth.isAuthenticated(false), Permission.required('client.update', false), client.put)
router.post('/clients', auth.isAuthenticated(false), Permission.required('self.client.create', false), client.post)
router.delete('/clients/:id', auth.isAuthenticated(false), Permission.required('client.delete', false),
client.delete)

router.get('/ships', ship.get)
router.post('/ships', ship.post)
router.get('/ships/:id', ship.getById)
router.put('/ships/:id', auth.isAuthenticated(false), ship.put)
router.delete('/ships/:id', auth.isAuthenticated(false), ship.delete)


router.get('/decals/check', auth.isAuthenticated(false), decal.check)
router.get('/decals/redeem', auth.isAuthenticated(false), decal.redeem)

router.get('/version', version.get)

router.get('/docs', docs.get)
router.get('/leaderboard', leaderboard.get)
router.get('/login', login.get)
router.get('/ssologin', ssologin.getLoginPage)
router.get('/reset', reset.get)
router.get('/change_password', change_password.get)
router.get('/paperwork', auth.isAuthenticated(true), paperwork.get)
router.get('/register', register.get)
router.get('/welcome', auth.isAuthenticated(true), welcome.get)
router.get('/profile', auth.isAuthenticated(true), profile.get)
router.get('/roster', roster.get)
router.get('/statistics', statistics.get)

router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)


router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)
router.post('/irc/message', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.message)
router.post('/irc/action', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.action)

//app.use(express.static(__dirname + '/static'))
app.use('/', router)
app.use('/api', router)

 */


app.use(router.routes())
app.use(router.allowedMethods())


/*
  // Send the response
app.use(function (request, response) {
  if (response.model.errors.length) {
    if (!request.referer) {
      delete response.model.data
      response.send(response.model)
    } else {
      switch (response.status) {
        case 403:
          response.render('errors/403', { error: response.model.errors })
          break

        case 503:
          response.render('errors/503', { error: response.model.errors })
          break

        default:
          response.render('errors/500', { error: response.model.errors })
          break
      }
    }
  } else {
    if (Object.getOwnPropertyNames(response.model.data).length === 0 && response.statusCode === 200) {
      delete response.model.data
      response.model.errors.push(Error.throw('not_found', request.path))
      response.status(404)
      response.send(response.model)
    } else {
      delete response.model.errors
      response.send(response.model)
    }
  }
})

*/

/*

let socket = new ws({
  server: httpServer
})

websocket.socket = socket

socket.on('connection', function (client) {
  client.subscribedStreams = []
  client.clientId = uid.sync(16)
  winston.info(`${Date()} Websocket connection established with ${client._socket.remoteAddress}
  assigned unique identifier ${client.clientId}`)
  client.send(JSON.stringify({
    meta: {
      action: 'welcome',
      id: client.clientId
    },
    data: {
      message: 'Welcome to the Fuel Rats API. You can check out the docs at /docs because @xlexi is awesome.'
    }
  }))

  client.on('close', function () {
    winston.info(`${Date()} Websocket connection to  ${client._socket.remoteAddress}
    with ID ${client.clientId} closed`)
  })

  client.on('message', function (data) {
    winston.info(`${Date()} Websocket message received from ${client._socket.remoteAddress} ID ${client.clientId}`)
    websocket.received(client, data)
  })
})

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

server.listen(port)
