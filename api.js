var _, bodyParser, cors, docket, docs, express, http, io, logger, mongoose, morgan, notAllowed, rat, rescue, app, httpServer, passport, path, port, router, socket;





// IMPORT
// =============================================================================

// Import config
config = require( './config' );

// Import libraries
_ = require( 'lodash' );
bodyParser = require( 'body-parser' );
cors = require( 'cors' );
// docket = require( './docket.js' );
docs = require( 'express-mongoose-docs' );
express = require( 'express' );
expressSession = require( 'express-session' );
http = require( 'http' );
mongoose = require( 'mongoose' );
morgan = require( 'morgan' );
passport = require( 'passport' );
path = require( 'path' );
io = require( 'socket.io' );
LocalStrategy = require( 'passport-local' ).Strategy;

// Import models
Rat = require( './models/rat' );
User = require( './models/user' );

// Import controllers
rat = require( './controllers/rat' );
rescue = require( './controllers/rescue' );

// Connect to MongoDB
mongoose.connect( 'mongodb://localhost/fuelrats' );





// SHARED METHODS
// =============================================================================

// Function for disallowed methods
notAllowed = function notAllowed ( request, response ) {
  response.status( 405 );
  response.send();
};





// MIDDLEWARE
// =============================================================================

app = express();
// app.use( morgan( 'combined' ) )
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

passport.use( User.createStrategy() );
passport.serializeUser( User.serializeUser() );
passport.deserializeUser( User.deserializeUser() );

app.use( expressSession({
  secret: 'foobarbazdiddlydingdongsdf]08st0agf/b',
  resave: false,
  saveUninitialized: false
}));
app.use( passport.initialize() );
app.use( passport.session() );

docs( app, mongoose );
// docket( app, mongoose );

// Combine query parameters with the request body, prioritizing the body
app.use( function ( request, response, next ) {
  request.body = _.extend( request.query, request.body );

  console.log( '' );
  console.log( 'ENDPOINT:', request.originalUrl );
  console.log( 'METHOD:', request.method );
  console.log( 'DATA:', request.body );

  next();
});





// ROUTER
// =============================================================================

// Create router
router = express.Router();





// ROUTES
// =============================================================================

router.post( '/register', function ( request, response ) {
  ratData = {}

  if ( request.body.CMDRname ) {
    ratData.CMDRname = request.body.CMDRname;
  }

  if ( request.body.gamertag ) {
    ratData.gamertag = request.body.gamertag;
  }

  rat = new Rat( ratData );

  user = new User({
    email: request.body.email,
    rat: rat._id
  });

  User.register( user, request.body.password, function ( error, user ) {
    if ( error ) {
      response.send( error );
      return;
    }

    Rat.create( rat );

    auth = passport.authenticate( 'local' );

    auth( request, response, function () {
      response.status( 200 );
      response.json( user );
    });
  });
});

router.post( '/login', passport.authenticate( 'local' ), function ( request, response ) {
  response.status( 200 );
  response.json( request.user );
});

router.get( '/rats/:id', rat.get );

router.get( '/rats', rat.get );
router.post( '/rats', rat.post );

router.get( '/rescues/:id', rescue.get );
router.post( '/rescues/:id', rescue.post );
router.put( '/rescues/:id', rescue.put );
router.delete( '/rescues/:id', notAllowed );

router.get( '/rescues', rescue.get );
router.post( '/rescues', rescue.post );
router.put( '/rescues', notAllowed );
router.delete( '/rescues', notAllowed );

router.get( '/search/rescues', rescue.search );

router.get( '/search/rats', rat.search );

// Register routes
app.use( '/api', router );
app.use( '/test', express.static( 'test' ) );
app.use( '/node_modules', express.static( 'node_modules' ) );





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
