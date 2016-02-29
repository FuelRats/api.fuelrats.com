'use strict'
// IMPORT
// =============================================================================

// Import libraries
let _ = require('underscore')
let bodyParser = require('body-parser')
let cors = require('cors')
let cookieParser = require('cookie-parser')
let express = require('express')
let expressHandlebars = require('express-handlebars')
let expressSession = require('express-session')
let fs = require('fs')
let forceSSL = require('express-force-ssl')
let http = require('http')
let lex = require('letsencrypt-express').testing()
let moment = require('moment')
let mongoose = require('mongoose')
let passport = require('passport')
let winston = require('winston')
let request = require('request')
let uid = require('uid-safe')
let ws = require('ws').Server

// Import config
let config = require('./config-example')

if (fs.existsSync('./config.json')) {
  _.extend(config, require('./config'))
}

// Import models
let User = require('./api/models/user')

// Import controllers
let badge = require('./api/controllers/badge')
let change_password = require('./api/controllers/change_password')
let docs = require('./api/controllers/docs')
let login = require('./api/controllers/login')
let logout = require('./api/controllers/logout')
let paperwork = require('./api/controllers/paperwork')
let rat = require('./api/controllers/rat')
let register = require('./api/controllers/register')
let reset = require('./api/controllers/reset')
let rescue = require('./api/controllers/rescue')
let rescueAdmin = require('./api/controllers/rescueAdmin')
let user = require('./api/controllers/user')
let version = require('./api/controllers/version')
let websocket = require('./api/websocket')
let welcome = require('./api/controllers/welcome')

// Connect to MongoDB
mongoose.connect('mongodb://' + config.mongo.hostname + ':' + config.mongo.port + '/' + config.mongo.database)

let options = {
  logging: true,
  test: false
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

app.engine('.hbs', expressHandlebars({
  defaultLayout: 'main',
  extname: '.hbs',
  helpers: {
    dateFormat: function (context, block) {
      context = moment(new Date(context))

      if (moment().diff(context, 'days') < 7) {
        return context.fromNow()
      } else {
        return context.add(1286, 'years').format(block.hash.format || 'MMM Do, YYYY')
      }
    }
  }
}))
app.set('view engine', '.hbs')

app.use(cors())
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json())
app.use(cookieParser())
app.use(expressSession({
  secret: config.secretSauce,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())

app.set('json spaces', 2)
app.set('x-powered-by', false)

let hostName = config.hostname
let sslHostName = config.ssl.hostname

let port = config.port || process.env.PORT
let sslPort = config.ssl.port || process.env.SSL_PORT

passport.use(User.createStrategy())
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

app.use(expressSession({
  secret: config.secretSauce,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
if (config.ssl) {
  app.use(forceSSL)
}

// Combine query parameters with the request body, prioritizing the body
app.use(function (request, response, next) {
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

    winston.info('')
    winston.info('TIMESTAMP:', Date.now())
    winston.info('ENDPOINT:', request.originalUrl)
    winston.info('METHOD:', request.method)
    winston.info('DATA:', censoredParams)
    next()
  })
}




// ROUTER
// =============================================================================

// Create router
let router = express.Router()




// ROUTES
// =============================================================================

router.get('/badge/:rat', badge.get)

router.post('/register', register.post)

router.post('/login', passport.authenticate('local'), login.post)
router.post('/reset', reset.post)
router.post('/change_password', change_password.post)

router.get('/logout', logout.post)
router.post('/logout', logout.post)

router.get('/rats', rat.get)
router.post('/rats', rat.post)
router.get('/rats/:id', rat.getById)
router.put('/rats/:id', rat.put)

router.get('/rescues', rescue.get)
router.post('/rescues', rescue.post)
router.get('/rescues/:id', rescue.getById)
router.put('/rescues/:id', rescue.put)
router.put('/rescues/:rescueId/assign/:ratId', rescue.assign)
router.put('/rescues/:rescueId/unassign/:ratId', rescue.unassign)

router.get('/users', user.get)
router.get('/users/:id', user.getById)

router.get('/search/rescues', rescue.get)
router.get('/search/rats', rat.get)

router.get('/version', version.get)

router.get('/docs', docs.get)
router.get('/login', login.get)
router.get('/reset', reset.get)
router.get('/change_password', change_password.get)
router.get('/paperwork', paperwork.get)
router.get('/register', register.get)
router.get('/welcome', welcome.get)

router.get('/rescues/view/:id', rescueAdmin.viewRescue)
router.get('/rescues/edit/:id', rescueAdmin.editRescue)
router.get('/rescues/list', rescueAdmin.listRescues)
router.get('/rescues/list/:page', rescueAdmin.listRescues)

// Register routes
app.use(express.static(__dirname + '/static'))
app.use('/', router)
app.use('/api', router)

let httpServer = http.Server(app)

  // Send the response
app.use(function (request, response) {
  if (response.model.errors.length) {
    delete response.model.data
  } else {
    delete response.model.errors
  }

  response.send(response.model)
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

if (config.ssl.enabled) {

  let firstRequestSent = false

  module.exports = lex.create({
    approveRegistration: function (hostname, callback) {
      callback(null, {
        domains: [hostname],
        email: 'tre@trezy.com',
        agreeTos: true
      })
    },
    onRequest: app
  }).listen(
    // Non SSL options
    [{
      port: port
    }],

    // SSL options
    [{
      port: sslPort
    }],

    function () {
      if (!module.parent) {
        if (!firstRequestSent) {
          winston.info('Starting the Fuel Rats API')
          winston.info('Listening for requests on ports ' + port + ' and ' + sslPort + '...')

          // Really, I shouldn't have to do this, but first request _always_ fails.
          request('https://' + sslHostName + ':' + sslPort + '/welcome', function () {
            winston.info('Firing initial request to generate certificates')
          })
          firstRequestSent = true
        }
      }
    }
  )

} else {
  module.exports = httpServer.listen(port, function () {
    if (!module.parent) {
      winston.info('Starting the Fuel Rats API')
      winston.info('Listening for requests on port ' + port + '...')
    }
  })
}
