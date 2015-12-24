var path





path = require( 'path' )





exports.get = function ( request, response ) {
  response.sendFile( path.join( __dirname + '/../templates/badge.html' ) )
}
