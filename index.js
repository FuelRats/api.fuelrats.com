var _, app, badge, bodyParser, config, cookieParser, cors, docket, docs, express, expressSession, fs, http, httpServer, io, LocalStrategy, logger, login, mongoose, notAllowed, options, passport, path, port, Rat, rat, register, Rescue, rescue, router, socket, ws





// IMPORT
// =============================================================================

// Import libraries
_ = require( 'underscore' )
bodyParser = require( 'body-parser' )
cors = require( 'cors' )
cookieParser = require( 'cookie-parser' )
// docket = require( './docket.js' )
docs = require( 'express-mongoose-docs' )
express = require( 'express' )
expressSession = require( 'express-session' )
fs = require( 'fs' )
http = require( 'http' )
mongoose = require( 'mongoose' )
passport = require( 'passport' )
path = require( 'path' )
LocalStrategy = require( 'passport-local' ).Strategy
ws = require( 'ws' ).Server

// Import config
if ( fs.existsSync( './config.json' ) ) {
  config = require( './config' )
} else {
  config = require( './config-example' )
}

// Import models
Rat = require( './api/models/rat' )
Rescue = require( './api/models/rescue' )
User = require( './api/models/user' )

// Import controllers
badge = require( './api/controllers/badge' )
login = require( './api/controllers/login' )
rat = require( './api/controllers/rat' )
register = require( './api/controllers/register' )
rescue = require( './api/controllers/rescue' )

// Connect to MongoDB
mongoose.connect( 'mongodb://localhost/fuelrats' )

options = {
  logging: true,
  test: false
}





// SHARED METHODS
// =============================================================================

// Function for disallowed methods
notAllowed = function notAllowed ( request, response ) {
  response.status( 405 )
  response.send()
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

httpServer = http.Server( app )

port = process.env.PORT || config.port

passport.use( User.createStrategy() )
passport.serializeUser( User.serializeUser() )
passport.deserializeUser( User.deserializeUser() )

app.use( expressSession({
  secret: 'foobarbazdiddlydingdongsdf]08st0agf/b',
  resave: false,
  saveUninitialized: false
}))
app.use( passport.initialize() )
app.use( passport.session() )

docs( app, mongoose )
// docket( app, mongoose )

// Combine query parameters with the request body, prioritizing the body
app.use( function ( request, response, next ) {
  request.body = _.extend( request.query, request.body )
  next()
})

// Add logging
if ( options.logging || options.test ) {
  app.use( function ( request, response, next ) {
    console.log( '' )
    console.log( 'ENDPOINT:', request.originalUrl )
    console.log( 'METHOD:', request.method )
    console.log( 'DATA:', request.body )
    next()
  })
}





// ROUTER
// =============================================================================

// Create router
router = express.Router()





// ROUTES
// =============================================================================

app.get( '/badge/:rat', badge.get )

app.get( '/register', register.get )
app.post( '/register', register.post )

app.get( '/login', login.get )
app.post( '/login', passport.authenticate( 'local' ), login.post )

router.get( '/rats/:id', rat.get )
router.post( '/rats/:id', rat.post )
router.put( '/rats/:id', rat.put )
router.delete( '/rats/:id', notAllowed )

router.get( '/rats', rat.get )
router.post( '/rats', rat.post )
router.put( '/rescues', notAllowed )
router.delete( '/rescues', notAllowed )

router.get( '/rescues/:id', rescue.get )
router.post( '/rescues/:id', rescue.post )
router.put( '/rescues/:id', rescue.put )
router.delete( '/rescues/:id', notAllowed )

router.get( '/rescues', rescue.get )
router.post( '/rescues', rescue.post )
router.put( '/rescues', notAllowed )
router.delete( '/rescues', notAllowed )

router.get( '/search/rescues', rescue.get )

router.get( '/search/rats', rat.get )

// Register routes
app.use( express.static( __dirname + '/static' ) )
app.use( '/', router )
app.use( '/api', router )
app.use( '/assets', express.static( __dirname + '/assets' ) )
app.use( '/bower_components', express.static( __dirname + '/bower_components' ) )
app.use( '/node_modules', express.static( __dirname + '/node_modules' ) )





// SOCKET
// =============================================================================

socket = new ws({ server: httpServer })

socket.on( 'connection', function ( socket ) {
  socket.send( JSON.stringify({
    data: 'Welcome! You\'ve connected to the Fuel Rats API server. Now GO AWAY.'
  }))
})





// START THE SERVER
// =============================================================================

module.exports = httpServer.listen( port )

if ( !module.parent ) {
  console.log( 'Listening for requests on port ' + port + '...' )
}
