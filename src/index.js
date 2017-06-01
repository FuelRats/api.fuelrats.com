import bodyParser from 'body-parser'
import cors from 'cors'
import compression from 'compression'
import cookieParser from 'cookie-parser'

import express from 'express'
import expressSession from 'express-session'
import fs from 'fs'
import http from 'http'
import passport from 'passport'
import Permission from './permission'
import winston from 'winston'
import uid from 'uid-safe'
import { Server as ws } from 'ws'
import { dedelimit } from 'dedelimit'
import npid from 'npid'
import 'winston-daily-rotate-file'

// Import config
let config = require('../config-example')

if (fs.existsSync('./config.json')) {
  Object.assign(config, require('../config'))
}

import API from './classes/API'
import Error from './errors'

// Import models
import { db, User, Rat } from './db'

// Import controllers
import auth from './controllers/auth'
import leaderboard from './controllers/leaderboard'
import login from './controllers/login'
import irc from './controllers/irc'
import jira from './controllers/jira'
import ssologin from './controllers/ssologin'
import logout from './controllers/logout'
import news from './controllers/news'
import nicknames from './controllers/nicknames'
import oauth2 from './controllers/oauth2'
import rat from './controllers/rat'
import register from './controllers/register'
import reset from './controllers/reset'
import rescue from './controllers/rescue'
import statistics from './controllers/statistics'
import user from './controllers/user'
import version from './controllers/version'
import websocket from './websocket'
import UserResult from './Results/user'

db.sync()

try {
  npid.remove('api.pid')
  let pid = npid.create('api.pid')
  pid.removeOnExit()
} catch (err) {
  winston.error(err)
  process.exit(1)
}


let options = {
  logging: true,
  test: false
}

if (process.env.CONTINOUS_INTEGRATION) {
  options.logging = false
}

if (process.argv) {
  for (let i = 0; i < process.argv.length; i++) {
    let arg = process.argv[i]
    switch (arg) {
      case '--no-log':
        options.logging = false
        break

      case '--test':
        options.test = true
        break
    }
  }
}

let transport = new winston.transports.DailyRotateFile({
  filename: './logs/',
  datePattern: 'yyyy-MM-dd.',
  prepend: true,
  level: process.env.ENV === 'development' ? 'debug' : 'info'
})

let logger = new (winston.Logger)({
  transports: [
    transport
  ]
})


// MIDDLEWARE
// =============================================================================

let app = express()

let sessionOptions = {
  cookie: config.cookie,
  secret: config.secretSauce,
  resave: false,
  saveUninitialized: false
}

app.use(cors())
app.use(compression())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(expressSession(sessionOptions))
app.use(passport.initialize())
passport.use(auth.LocalStrategy)

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  User.findOne({
    where: {id: id}
  }).then(function (user) {
    let result = new UserResult(user).toResponse()
    done(null, result)
  }).catch(function (error) {
    done(error)
  })
})

app.set('json spaces', 2)
app.set('x-powered-by', false)

let port = config.port || process.env.PORT

app.use(passport.initialize())
app.use(passport.session())

// Combine query parameters with the request body, prioritizing the body
app.use(function (request, response, next) {
  request.websocket = websocket

  request.body = Object.assign(request.query, request.body)

  response.model = {
    data: {},
    errors: [],
    links: {
      self: request.originalUrl
    },
    meta: {
      method: request.method,
      params: Object.assign(request.query, request.body),
      timestamp: new Date().toISOString()
    }
  }

  dedelimit(request.query, function (err, query) {
    request.query = query
    next()
  })
})

// Add logging
if (options.logging || options.test) {
  app.use(function (request, response, next) {
    let censoredParams = Object.assign(response.model.meta.params)
    if (censoredParams.password) {
      censoredParams.password = '**********'
    }

    logger.info('')
    logger.info('TIMESTAMP:', Date.now())
    logger.info('ENDPOINT:', request.originalUrl)
    logger.info('METHOD:', request.method)
    logger.info('HEADERS:', request.headers)
    logger.info('DATA:', censoredParams)
    request.inet = request.headers['x-forwarded-for'] || request.connection.remoteAddress
    next()
  })
}




// ROUTER
// =============================================================================

// Create router
let router = express.Router()


// ROUTES
// =============================================================================
router.get('/v2/rescues', API.version('v2.0'), API.route(rescue.search))
router.post('/v2/rescues', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.create))
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

router.post('/login', passport.authenticate('local'), login.post)
router.post('/ssologin', passport.authenticate('local'), ssologin.loginWithCredentials)
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
*/

router.route('/oauth2/authorize')
  .get(auth.isAuthenticated(true), oauth2.authorization)
  .post(auth.isAuthenticated(false), oauth2.decision)

// Create endpoint handlers for oauth2 token
router.route('/oauth2/token').post(auth.isClientAuthenticated, oauth2.token)

router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jira.post)
router.post('/irc/message', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.message)
router.post('/irc/action', auth.isAuthenticated(false), Permission.required('irc.oper', false), irc.action)

// Register routes
app.use(express.static(__dirname + '/static'))
app.use('/', router)
app.use('/api', router)

let httpServer = http.Server(app)

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

/* Because express.js is stupid and uses the method signature to distinguish between
normal middleware and error middleware, we have to silence eslint complaining about
the unused error */
/* eslint-disable no-unused-vars */
app.use(function (err, req, res, next) {
  /* eslint-enable no-unused-vars */
  res.status(err.code)
  res.send({
    errors: [err]
  })
})

// SOCKET
// =============================================================================

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




// START THE SERVER
// =============================================================================
module.exports = httpServer.listen(port, function () {
  if (!module.parent) {
    winston.info('Starting the Fuel Rats API')
    winston.info('Listening for requests on port ' + port + '...')
  }
})
