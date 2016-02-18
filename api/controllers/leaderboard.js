var path, Rat

path = require( 'path' )



exports.get = function ( request, response ) {
  response.render( 'leaderboard' )
}
