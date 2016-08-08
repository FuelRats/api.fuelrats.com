var path, Rat





path = require( 'path' )

Rat = require( '../models/rat' )





exports.get = function ( request, response ) {
  if ( request.isUnauthenticated() ) {
    response.render( 'paperwork.swig' )
  } else {
    Rat.findById( request.user.rat )
    .exec( function ( error, rat ) {
      request.user.rat = rat
      response.render( 'paperwork.swig', request.user )
    })
  }
}
