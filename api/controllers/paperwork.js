var path





path = require( 'path' )






exports.get = function ( request, response ) {
  response.render( 'paperwork.swig')
}
