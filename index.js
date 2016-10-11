'use strict'

// IMPORT
// =============================================================================

// Import libraries
let _ = require('underscore')
let bodyParser = require('body-parser')
let cors = require('cors')
let compression = require('compression')
let cookieParser = require('cookie-parser')
let express = require('express')
let expressSession = require('express-session')
let fs = require('fs')
let http = require('http')
let moment = require('moment')
let passport = require('passport')
let Permission = require('./api/permission')
let winston = require('winston')
let swig = require('swig')
let uid = require('uid-safe')
let ws = require('ws').Server
let dedelimit = require('dedelimit').dedelimit

// Import config
let config = require('./config-example')

if (fs.existsSync('./config.json')) {
  _.extend(config, require('./config'))
}

let API = require('./api/classes/API')
let Error = require('./api/errors')

// Import models
let db = require('./api/db').db
let User = require('./api/db').User
let Rat = require('./api/db').Rat

// Import controllers
let auth = require('./api/controllers/auth')
let change_password = require('./api/controllers/change_password')
let client = require('./api/controllers/client').HTTP
let docs = require('./api/controllers/docs')
let login = require('./api/controllers/login')
let logout = require('./api/controllers/logout')
let nicknames = require('./api/controllers/nicknames').HTTP
let oauth2 = require('./api/controllers/oauth2')
let rat = require('./api/controllers/rat').HTTP
let register = require('./api/controllers/register')
let reset = require('./api/controllers/reset')
let rescue = require('./api/controllers/rescue')
let statistics = require('./api/controllers/statistics')
let user = require('./api/controllers/user').HTTP
let version = require('./api/controllers/version')
let websocket = require('./api/websocket')
let jiraDrill = require('./api/controllers/jira/drill').HTTP
let UserResult = require('./api/Results/user')

db.sync()


let options = {
  logging: true,
  test: false
}

if (process.env.CONTINOUS_INTEGRATION) {
  options.logging = false
}


// Parse command line arguments
// =============================================================================

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


// MIDDLEWARE
// =============================================================================

let app = express()

app.engine('.swig', swig.renderFile)
app.set('views', __dirname + '/views')
app.set('view cache', false)

swig.setFilter('eliteDate', function (date, args) {
  let context = moment(date)
  if (moment().diff(context, 'days') < 7) {
    return context.fromNow()
  } else {
    return context.add(1286, 'years').format(args || 'YYYY-MM-DD HH:mm')
  }
})

swig.setFilter('eliteDateNoFormat', function (date, args) {
  let context = moment(date)
  return context.add(1286, 'years').format(args || 'YYYY-MM-DD HH:mm')
})

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
    done(err)
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

  request.body = _.extend(request.query, request.body)

  response.model = {
    data: {},
    errors: [],
    links: {
      self: request.originalUrl
    },
    meta: {
      method: request.method,
      params: _.extend(request.query, request.body),
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
    var censoredParams = _.clone(response.model.meta.params)
    if (censoredParams.password) {
      censoredParams.password = '**********'
    }

    winston.info('')
    winston.info('TIMESTAMP:', Date.now())
    winston.info('ENDPOINT:', request.originalUrl)
    winston.info('METHOD:', request.method)
    winston.info('DATA:', censoredParams)
    winston.info('IP:', request.headers['x-forwarded-for'] || request.connection.remoteAddress)
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
router.get('/rescues', API.version('v1.0'), rescue.search)
router.get('/v2/rescues', API.version('v2.0'), API.route(rescue.search))
router.post('/v2/rescues', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.create))
router.put('/v2/rescues/:id', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.update))
router.delete('/v2/rescues/:id', API.version('v2.0'), auth.isAuthenticated, Permission.required('rescue.delete'), API.route(rescue.delete))
router.put('/v2/rescues/:id/assign', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.assign))
router.put('/v2/rescues/:id/unassign', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.unassign))
router.put('/v2/rescues/:id/addquote', API.version('v2.0'), auth.isAuthenticated, API.route(rescue.addquote))

router.get('/v2/statistics/rescues', API.version('v2.0'), API.route(statistics.rescues))
router.get('/v2/statistics/systems', API.version('v2.0'), API.route(statistics.systems))

router.post('/login', passport.authenticate('local'), login.post)
/*


router.post('/register', register.post)

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

router.post('/rescues', auth.isAuthenticated(false), rescue.post)
router.get('/rescues/:id', rescue.getById)
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

router.get('/nicknames/search/:nickname', nicknames.search)
router.get('/nicknames/:nickname', auth.isAuthenticated(false), Permission.required('self.user.read', false), nicknames.get)
router.post('/nicknames/', auth.isAuthenticated(false), Permission.required('self.user.update', false), nicknames.post)
router.put('/nicknames/', auth.isAuthenticated(false), Permission.required('self.user.update', false), nicknames.put)
router.delete('/nicknames/:nickname', auth.isAuthenticated(false), Permission.required('self.user.update', false), nicknames.delete)

router.get('/clients', auth.isAuthenticated(false), Permission.required('client.read', false), client.get)
router.put('/clients/:id', auth.isAuthenticated(false), Permission.required('client.update', false), client.put)
router.post('/clients', auth.isAuthenticated(false), Permission.required('self.client.create', false), client.post)
router.delete('/clients/:id', auth.isAuthenticated(false), Permission.required('client.delete', false), client.delete)

router.get('/version', version.get)

router.get('/docs', docs.get)
router.get('/statistics', statistics.get)
router.route('/oauth2/authorise')
  .get(auth.isAuthenticated(true), oauth2.authorization)
  .post(auth.isAuthenticated(false), oauth2.decision)

router.route('/oauth2/authorize')
  .get(auth.isAuthenticated(true), oauth2.authorization)
  .post(auth.isAuthenticated(false), oauth2.decision)

// Create endpoint handlers for oauth2 token
router.route('/oauth2/token').post(auth.isClientAuthenticated, oauth2.token)

router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)
*/

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
      response.model.errors = Error.throw('not_found', request.path)
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
  if (res.model) {
    delete res.model.data
    res.model.errors.push(err)
    if (err.code) {
      res.status(err.code)
    }
  }
  res.send(res.model)
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
