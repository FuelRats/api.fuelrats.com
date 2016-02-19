var path, Rat

path = require( 'path' )



exports.get = function ( request, response, next) {
  response.model.data = {}
  response.status( 200 )

  next()
}
