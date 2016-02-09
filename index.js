var _,
    app,
    badge,
    bodyParser,
    config,
    cookieParser,
    cors,
    docs,
    express,
    expressSession,
    fs,
    hostName,
    https,
    httpServer,
    io,
    lex,
    LocalStrategy,
    logger,
    login,
    logout,
    moment,
    mongoose,
    options,
    paperwork,
    passport,
    path,
    port,
    Rat,
    rat,
    register,
    Rescue,
    rescue,
    request,
    router,
    socket,
    sslHostName,
    sslPort,
    version,
    welcome,
    winston,
    ws





// IMPORT
// =============================================================================

// Import libraries
_ = require( 'underscore' )
bodyParser = require( 'body-parser' )
cors = require( 'cors' )
cookieParser = require( 'cookie-parser' )
express = require( 'express' )
expressHandlebars = require( 'express-handlebars' )
expressSession = require( 'express-session' )
fs = require( 'fs' )
http = require( 'http' )
lex = require( 'letsencrypt-express' ).testing()
moment = require( 'moment' )
mongoose = require( 'mongoose' )
passport = require( 'passport' )
path = require( 'path' )
LocalStrategy = require( 'passport-local' ).Strategy
winston = require( 'winston' )
request = require( 'request' );
ws = require( 'ws' ).Server

// Import config
config = require( './config-example' )

if ( fs.existsSync( './config.json' ) ) {
  _.extend( config, require( './config' ) )
}

// Import models
Rat = require( './api/models/rat' )
Rescue = require( './api/models/rescue' )
User = require( './api/models/user' )

// Import controllers
badge = require( './api/controllers/badge' )
docs = require( './api/controllers/docs' )
login = require( './api/controllers/login' )
logout = require( './api/controllers/logout' )
paperwork = require( './api/controllers/paperwork' )
rat = require( './api/controllers/rat' )
register = require( './api/controllers/register' )
rescue = require( './api/controllers/rescue' )
rescueAdmin = require( './api/controllers/rescueAdmin' )
version = require( './api/controllers/version' )
welcome = require( './api/controllers/welcome' )

// Connect to MongoDB
mongoose.connect( 'mongodb://localhost/fuelrats' )

options = {
  logging: true,
  test: false
}





// SHARED METHODS
// =============================================================================

// Add a broadcast method for websockets
ws.prototype.broadcast = function ( data ) {
  var clients

  clients = this.clients

  for ( var i = 0; i < clients.length; i++ ) {
    clients[i].send( data )
  }
}





// Parse command line arguments
// =============================================================================

if ( process.argv ) {
  for ( var i = 0; i < process.argv.length; i++ ) {
    var arg

    arg = process.argv[i]

    switch ( arg ) {
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

app = express()

app.engine( '.hbs', expressHandlebars({
  defaultLayout: 'main',
  extname: '.hbs',
  helpers: {
    dateFormat: function( context, block ) {
      context = moment( new Date( context ) )

      if ( moment().diff( context, 'days' ) < 7 ) {
        return context.fromNow()
      } else {
        return context.add( 1286, 'years' ).format( block.hash.format || "MMM Do, YYYY" )
      }
    }
  }
}))
app.set( 'view engine', '.hbs' )

app.use( cors() )
app.use( bodyParser.urlencoded( { extended: true } ) )
app.use( bodyParser.json() )
app.use( cookieParser() )
app.use( expressSession({
  secret: config.secretSauce,
  resave: false,
  saveUninitialized: false
}))
app.use( passport.initialize() )
app.use( passport.session() )

app.set( 'json spaces', 2 )
app.set( 'x-powered-by', false )

hostName = config.hostname
sslHostName = config.sslHostname

port = process.env.PORT || config.port
sslPort = process.env.SSL_PORT || config.sslPort

passport.use( User.createStrategy() )
passport.serializeUser( User.serializeUser() )
passport.deserializeUser( User.deserializeUser() )

app.use( expressSession({
  secret: config.secretSauce,
  resave: false,
  saveUninitialized: false
}))
app.use( passport.initialize() )
app.use( passport.session() )

// Combine query parameters with the request body, prioritizing the body
app.use( function ( request, response, next ) {
  request.body = _.extend( request.query, request.body )

  response.model = {
    data: {},
    errors: [],
    links: {
      self: request.originalUrl
    },
    meta: {
      method: request.method,
      params: _.extend( request.query, request.body ),
      timestamp: new Date().toISOString()
    }
  }

  next()
})

// Add logging
if ( options.logging || options.test ) {
  app.use( function ( request, response, next ) {
    winston.info( '' )
    winston.info( 'TIMESTAMP:', Date.now() )
    winston.info( 'ENDPOINT:', request.originalUrl )
    winston.info( 'METHOD:', request.method )
    winston.info( 'DATA:', response.model.meta.params )
    next()
  })
}





// ROUTER
// =============================================================================

// Create router
router = express.Router()





// ROUTES
// =============================================================================

router.get( '/badge/:rat', badge.get )

router.post( '/register', register.post )

router.post( '/login', passport.authenticate( 'local' ), login.post )

router.get( '/logout', logout.post )
router.post( '/logout', logout.post )

router.get( '/rats', rat.get )
router.post( '/rats', rat.post )
router.get( '/rats/:id', rat.getById )
router.put( '/rats/:id', rat.put )

router.get( '/rescues', rescue.get )
router.post( '/rescues', rescue.post )
router.get( '/rescues/:id', rescue.getById )
router.put( '/rescues/:id', rescue.put )

router.get( '/search/rescues', rescue.get )
router.get( '/search/rats', rat.get )

router.get( '/version', version.get )

router.get( '/docs', docs.get )
router.get( '/login', login.get )
router.get( '/paperwork', paperwork.get )
router.get( '/register', register.get )
router.get( '/welcome', welcome.get )

router.get( '/rescue/:id', rescueAdmin.viewRescue )
router.get( '/admin/rescues', rescueAdmin.listRescues )
router.get( '/admin/rescues/:page', rescueAdmin.listRescues )
router.get( '/admin/rescue/:id', rescueAdmin.editRescue )

// Register routes
app.use( express.static( __dirname + '/static' ) )
app.use( '/', router )
app.use( '/api', router )

httpServer = http.Server( app )
//=======
// Send the response
app.use( function ( request, response, next ) {
  if ( response.model.errors.length ) {
    delete response.model.data
  } else {
    delete response.model.errors
  }

  response.send( response.model )
})





// SOCKET
// =============================================================================

socket = new ws({ server: httpServer })

socket.on( 'connection', function ( client ) {
  client.send( JSON.stringify({
    data: 'Welcome to the Fuel Rats API. You can check out the docs at /docs because @xlexi is awesome.',
    type: 'welcome'
  }))

  client.on( 'message', function ( data ) {
    data = JSON.parse( data )
    winston.info( data )
    client.send( JSON.stringify({
      data: data,
      type: 'test'
    }))
  })
})





// START THE SERVER
// =============================================================================

if ( config.ssl ) {
    
    var firstRequestSent = false
    
  module.exports = lex.create({
    approveRegistration: function ( hostname, callback ) {
      callback( null, {
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
      if ( !module.parent ) {
        if( !firstRequestSent ) {
            winston.info( 'Starting the Fuel Rats API' )
            winston.info( 'Listening for requests on ports ' + port + ' and ' + sslPort + '...' )
            
            // Really, I shouldn't have to do this, but first request _always_ fails.
            request('https://' + sslHostName + ':' + sslPort + '/welcome', function() {
                winston.info( 'Firing initial request to generate certificates')
            })
            firstRequestSent = true
        }
      }
    }
  )

} else {
  module.exports = httpServer.listen( port, function () {
    if ( !module.parent ) {
      winston.info( 'Starting the Fuel Rats API' )
      winston.info( 'Listening for requests on port ' + port + '...' )
    }
  })
}
