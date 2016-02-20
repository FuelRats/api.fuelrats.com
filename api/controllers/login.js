var _, path, Rat, Rescue, winston





_ = require( 'underscore' )
path = require( 'path' )
winston = require( 'winston' )

Rat = require( '../models/rat' )
Rescue = require( '../models/rescue' )





exports.get = function ( request, response ) {
  if ( request.isUnauthenticated() ) {
    response.render('login', request.query);
  } else {
    response.redirect( '/welcome' )
  }
}





exports.post = function ( request, response ) {
  var referer, responseModel

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  Rat.findById( request.user.rat )
  .exec( function ( error, rat ) {
    var status

    if ( error ) {
      responseModel.errors = []
      responseModel.errors.push( error )
      status = 400

    } else {
      request.user.rat = rat
      responseModel.data = request.user
      status = 200
    }

    if ( referer = request.get( 'Referer' ) ) {
      response.redirect( '/login' )

    } else {
      response.status( status )
      response.json( responseModel )
    }
  })
}
