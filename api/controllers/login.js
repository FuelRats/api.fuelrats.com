var path





path = require( 'path' )





exports.get = function ( request, response ) {
  response.sendFile( path.join( __dirname + '/../templates/login.html' ) )
}





exports.post = function ( request, response ) {
  response.status( 200 )
  response.json( request.user )
}
