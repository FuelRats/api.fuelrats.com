'use strict'

// IMPORT
// =============================================================================
const Koa = require('koa')
const session = require('koa-session')
const cors = require('koa-cors')
const router = require('koa-router')()
const app = new Koa()
const TrafficControl = require('./api/TrafficControl')


// Import libraries
const compression = require('compression')
const fs = require('fs')
const http = require('http')
const Permission = require('./api/permission')
const winston = require('winston')
const uid = require('uid-safe')
const ws = require('ws').Server
const dedelimit = require('dedelimit').dedelimit
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
const auth = require('./api/controllers/auth')
const change_password = require('./api/controllers/change_password')
const client = require('./api/controllers/client').HTTP
const decal = require('./api/controllers/decal').HTTP
const docs = require('./api/controllers/docs')
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
const websocket = require('./api/websocket')
const jiraDrill = require('./api/controllers/jira/drill').HTTP
const UserResult = require('./api/Results/user')

db.sync()


try {
  npid.remove('api.pid')
  let pid = npid.create('api.pid')
  pid.removeOnExit()
} catch (err) {
  process.exit(1)
}

app.keys = [config.secret]

let sessionConfiguration = {
  key: 'fuelrats:session',
  overwrite: true,
  signed: true
}

app.use(session(sessionConfiguration, app))
app.use(cors())

let port = config.port || process.env.PORT

app.use(function (ctx, next) {
  dedelimit(ctx.query, function (err, query) {
    ctx.query = query
    next()
  })
})

app.use(async (ctx, next) => {
  if (ctx.request.is('json')) {
    try {
      ctx.body = JSON.parse(ctx.body)
      await next()
    } catch (err) {
      console.log(err)
    }
  }
})


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
    console.log(result)
  } catch (ex) {
    console.log(ex)
    await next(ex)
  }
})


// ROUTES
// =============================================================================
router.get('/v2/rescues', rescue.search)
/* router.post('/v2/rescues', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.create))
router.put('/v2/rescues/:id', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.update))
router.delete('/v2/rescues/:id', API.version('v2.0'), auth.isAuthenticated, Permission.required(['rescue.delete']), API.route(rescue.delete))
router.put('/v2/rescues/:id/assign', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.assign))
router.put('/v2/rescues/:id/unassign', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.unassign))
router.put('/v2/rescues/:id/addquote', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.addquote))
router.put('/v2/rescues/:id', API.version('v2.0'), API.route(rescue.getById))

router.get('/v2/rats', API.version('v2.0'), API.route(rat.search))
router.post('/v2/rats', API.version('v2.0'), auth.isAuthenticated, API.route(rat.create))
router.put('/v2/rats/:id', API.version('v2.0'), auth.isAuthenticated, API.route(rat.update))
router.delete('/v2/rats/:id', API.version('v2.0'), auth.isAuthenticated, Permission.required(['rat.delete']), API.route(rat.delete))

router.get('/v2/users', API.version('v2.0'), auth.isAuthenticated, API.route(user.search))
router.post('/v2/users', API.version('v2.0'), auth.isAuthenticated, Permission.required(['user.write']), API.route(user.create))
router.put('/v2/users/:id', API.version('v2.0'), auth.isAuthenticated, API.route(user.update))
router.delete('/v2/users/:id', API.version('v2.0'), auth.isAuthenticated, Permission.required(['user.delete']), API.route(user.delete))

router.get('/v2/nicknames/search/:nickname', API.route(nicknames.search))
router.get('/v2/nicknames/:nickname', auth.isAuthenticated, Permission.required(['user.read.me']), API.route(nicknames.info))
router.post('/v2/nicknames/', auth.isAuthenticated, Permission.required(['user.write.me']), API.route(nicknames.register))
router.put('/v2/nicknames/', auth.isAuthenticated, Permission.required(['user.write.me']), API.route(nicknames.connect))
router.delete('/v2/nicknames/:nickname', auth.isAuthenticated, Permission.required(['user.write.me']), API.route(nicknames.delete))


router.get('/v2/statistics/rescues', API.version('v2.0'), API.route(statistics.rescues))
router.get('/v2/statistics/systems', API.version('v2.0'), API.route(statistics.systems))


router.post('/register', register.post)

// router.post('/login', passport.authenticate('local'), login.post)
// router.post('/ssologin', passport.authenticate('local'), ssologin.loginWithCredentials)
router.post('/register', register.post)

router.get('/v2/news', API.route(news.list))



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
router.delete('/rescues/:id', auth.isAuthenticated(false), Permission.required('rescue.delete', false), rescue.delete)


router.get('/users', auth.isAuthenticated(false), Permission.required('user.read', false), user.get)
router.get('/users/:id/forceUpdateIRCStatus', auth.isAuthenticated(false), Permission.required('user.update', false), user.getById)
router.get('/users/:id', auth.isAuthenticated(false), Permission.required('user.read', false), user.getById)
router.put('/users/:id', auth.isAuthenticated(false), user.put)
router.post('/users', auth.isAuthenticated(false), user.post)
router.delete('/users/:id', auth.isAuthenticated(false), Permission.required('user.delete', false), user.delete)

router.get('/nicknames/search/:nickname', auth.isAuthenticated(false), nicknames.search)
router.get('/nicknames/:nickname', auth.isAuthenticated(false), Permission.required('self.user.read', false), nicknames.get)
router.post('/nicknames/', auth.isAuthenticated(false), Permission.required('self.user.update', false), nicknames.post)
router.put('/nicknames/', auth.isAuthenticated(false), Permission.required('self.user.update', false), nicknames.put)
router.delete('/nicknames/:nickname', auth.isAuthenticated(false), Permission.required('self.user.update', false), nicknames.delete)

router.get('/clients', auth.isAuthenticated(false), Permission.required('client.read', false), client.get)
router.put('/clients/:id', auth.isAuthenticated(false), Permission.required('client.update', false), client.put)
router.post('/clients', auth.isAuthenticated(false), Permission.required('self.client.create', false), client.post)
router.delete('/clients/:id', auth.isAuthenticated(false), Permission.required('client.delete', false), client.delete)

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

router.route('/oauth2/authorize')
  .get(auth.isAuthenticated(true), oauth2.authorization)
  .post(auth.isAuthenticated(false), oauth2.decision)

// Create endpoint handlers for oauth2 token
router.route('/oauth2/token').post(auth.isClientAuthenticated, oauth2.token)

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
  winston.info(`${Date()} Websocket connection established with ${client._socket.remoteAddress} assigned unique identifier ${client.clientId}`)
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
    winston.info(`${Date()} Websocket connection to  ${client._socket.remoteAddress} with ID ${client.clientId} closed`)
  })

  client.on('message', function (data) {
    winston.info(`${Date()} Websocket message received from ${client._socket.remoteAddress} ID ${client.clientId}`)
    websocket.received(client, data)
  })
})

*/

app.listen(port)
