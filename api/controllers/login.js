var path, Rat





path = require( 'path' )

Rat = require( '../models/rat' )





exports.get = function ( request, response ) {
  response.sendFile( path.join( __dirname + '/templates/login.html' ) )
}





exports.post = function ( request, response ) {
  var responseModel

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

    response.status( status )
    response.json( responseModel )
  })
}
