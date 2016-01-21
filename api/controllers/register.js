var passport, path, Rat, rat, User, user





passport = require( 'passport' )
path = require( 'path' )

Rat = require( '../models/rat.js' )
User = require( '../models/user.js' )





exports.get = function ( request, response ) {
  response.sendFile( path.join( __dirname + '/templates/register.html' ) )
}





exports.post = function ( request, response ) {
  var ratData

  ratData = {}

  if ( request.body.CMDRname ) {
    ratData.CMDRname = request.body.CMDRname
  }

  if ( request.body.gamertag ) {
    ratData.gamertag = request.body.gamertag
  }

  rat = new Rat( ratData )

  user = new User({
    email: request.body.email,
    rat: rat._id
  })

  User.register( user, request.body.password, function ( error, user ) {
    var auth

    if ( error ) {
      response.send( error )
      return
    }

    Rat.create( rat )

    auth = passport.authenticate( 'local' )

    auth( request, response, function () {
      var responseModel

      responseModel = {
        links: {
          self: request.originalUrl
        }
      }

      Rat.findById( user.rat )
      .exec( function ( error, rat ) {
        var status

        if ( error ) {
          responseModel.errors = []
          responseModel.errors.push( error )
          status = 400

        } else {
          request.user.rat = rat
          responseModel.data = user
          status = 200
        }

        response.status( status )
        response.json( responseModel )
      })
    })
  })
}
