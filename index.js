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

let npid = require('npid')
require('winston-daily-rotate-file')

// Import config
let config = require('./config-example')

if (fs.existsSync('./config.json')) {
  _.extend(config, require('./config'))
}

let Error = require('./api/errors')

// Import models
let db = require('./api/db').db
let User = require('./api/db').User
let Rat = require('./api/db').Rat
require('./api/models/client')

// Import controllers
let auth = require('./api/controllers/auth')
let badge = require('./api/controllers/badge')
let change_password = require('./api/controllers/change_password')
let client = require('./api/controllers/client').HTTP
let docs = require('./api/controllers/docs')
let leaderboard = require('./api/controllers/leaderboard')
let login = require('./api/controllers/login')
let ssologin = require('./api/controllers/ssologin')
let logout = require('./api/controllers/logout')
let nicknames = require('./api/controllers/nicknames').HTTP
let oauth2 = require('./api/controllers/oauth2')
let paperwork = require('./api/controllers/paperwork')
let profile = require('./api/controllers/profile')
let rat = require('./api/controllers/rat').HTTP
let register = require('./api/controllers/register')
let reset = require('./api/controllers/reset')
let roster = require('./api/controllers/roster').HTTP
let rescue = require('./api/controllers/rescue').HTTP
let rescueAdmin = require('./api/controllers/rescueAdmin')
let statistics = require('./api/controllers/statistics')
let user = require('./api/controllers/user').HTTP
let version = require('./api/controllers/version')
let websocket = require('./api/websocket')
let welcome = require('./api/controllers/welcome')
let jiraDrill = require('./api/controllers/jira/drill').HTTP

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

let platformHumanReadable = {
  'pc': 'PC',
  'xb': 'XB1',
  'ps': 'PS4',
  'unknown': '?'
}

swig.setFilter('formatPlatform', function (platformIdentifier, args) {
  return platformHumanReadable[platformIdentifier]
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
    where: { id: id },
    attributes: {
      include: [
        [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
      ],
      exclude: [
        'nicknames',
        'dispatch',
        'deletedAt'
      ]
    },
    include: [
      {
        model: Rat,
        as: 'rats',
        required: false
      }
    ]
  }).then(function (userInstance) {
    let user = userInstance.toJSON()
    let reducedRats = user.rats.map(function (rat) {
      return rat.id
    })
    user.CMDRs = reducedRats
    delete user.rats
    delete user.dispatch
    done(null, user)
  }).catch(function () {
    done(null, false)
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

  next()
})

// Add logging
if (options.logging || options.test) {
  app.use(function (request, response, next) {
    var censoredParams = _.clone(response.model.meta.params)
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

router.get('/badge', badge.get)

router.post('/register', register.post)

router.post('/login', passport.authenticate('local'), login.post)
router.post('/ssologin', passport.authenticate('local'), ssologin.loginWithCredentials)
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

router.get('/rescues', rescue.get)
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

router.get('/nicknames/search/:nickname', auth.isAuthenticated(false), nicknames.search)
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

router.get('/rescues/view/:id', rescueAdmin.viewRescue)
router.get('/rescues/edit/:id', auth.isAuthenticated(true), Permission.required('rescue.edit', true), rescueAdmin.editRescue)

router.route('/oauth2/authorize')
  .get(auth.isAuthenticated(true), oauth2.authorization)
  .post(auth.isAuthenticated(false), oauth2.decision)

// Create endpoint handlers for oauth2 token
router.route('/oauth2/token').post(auth.isClientAuthenticated, oauth2.token)

router.post('/jira/drill', auth.isJiraAuthenticated(), Permission.required('user.update', false), jiraDrill.post)


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
