var bodyParser, cors, express, http, io, mongoose, notAllowed, rat, rescue, app, httpServer, passport, port, router, socket;

// IMPORT
// =============================================================================

// Import config
config = require( './config' );

// Import libraries
bodyParser = require( 'body-parser' );
cors = require( 'cors' );
express = require( 'express' );
expressSession = require( 'express-session' );
http = require( 'http' );
mongoose = require( 'mongoose' );
passport = require( 'passport' );
io = require( 'socket.io' );
LocalStrategy = require( 'passport-local' ).Strategy;

// Import models
User = require( './models/user' );

// Import controllers
rat = require( './controllers/rat' );
rescue = require( './controllers/rescue' );

// Connect to MongoDB
mongoose.connect( 'mongodb://localhost/fuelrats' );

// Prepare the Express server
// =============================================================================

app = express();
app.use( cors() );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( expressSession({
  secret: config.secretSauce,
  resave: false,
  saveUninitialized: false
}));
app.use( passport.initialize() );
app.use( passport.session() );

app.set( 'json spaces', 2 );
app.set( 'x-powered-by', false );

httpServer = http.Server( app );

port = process.env.PORT || config.port;

// Prepare the Passport
// =============================================================================
passport.use( User.createStrategy() );
passport.serializeUser( User.serializeUser() );
passport.deserializeUser( User.deserializeUser() );

// ROUTES
// =============================================================================

app.use( expressSession({
  secret: 'foobarbazdiddlydingdongsdf]08st0agf/b',
  resave: false,
  saveUninitialized: false
}));
app.use( passport.initialize() );
app.use( passport.session() );

// ROUTES
// =============================================================================

// Create router
router = express.Router();

// Create middleware
router.use( function ( request, response, next ) {
  console.log( '' );
  console.log( request.method, request.originalUrl );
  console.log( request.body );
  next();
});

// Function for disallowed methods
notAllowed = function notAllowed ( request, response ) {
  response.status( 405 );
  response.send( 'Method Not Allowed' );
}

/*****************************************************************************\
PUT /rats/:id
Updates a rat

GET /rats/:id
Gets a rat
\*****************************************************************************/
router.route( '/rats/:id' )
.get( rat.get );

/*****************************************************************************\
POST /rats
Creates a rat

GET /rats/:id
Gets a list of rats
\*****************************************************************************/
router.route( '/rats' )
.get( rat.get )
.post( rat.post );

/*****************************************************************************\
PUT /rescues/:id
Updates a rescue

GET /rescues/:id
Gets a rescue
\*****************************************************************************/
router.route( '/rescues/:id' )
.get( rescue.get )
.post( rescue.post )
.put( rescue.put )
.delete( notAllowed );

/*****************************************************************************\
POST /rescues
Creates a rescue

GET /rescues/:id
Gets a list of rescues
\*****************************************************************************/
router.route( '/rescues' )
.get( rescue.get )
.post( rescue.post )
.put( notAllowed )
.delete( notAllowed );

router.route( '/search/rescues/:query' )
.get( rescue.search );

router.route( '/search/rescues' )
.get( rescue.get );

router.route( '/search/rats/:query' )
.get( rat.search );

router.route( '/search/rats' )
.get( rat.get );

// Register routes
app.use( '/api', router );

// SOCKET
// =============================================================================

socket = io( httpServer );

socket.on( 'connection', function ( socket ) {
  console.log( 'a user connected' );
});

// START THE SERVER
// =============================================================================
httpServer.listen( port );
console.log( 'Listening for requests on port ' + port + '...' );
