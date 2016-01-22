var path, Rat





path = require( 'path' )

Rat = require( '../models/rat' )





exports.get = function ( request, response ) {
  if ( request.isUnauthenticated() ) {
    response.render( 'login' )
  } else {
    Rat.findById( request.user.rat )
    .exec( function ( error, rat ) {
      request.user.rat = rat
      response.render( 'welcome', request.user )
    })
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
