var aglio, options, path, winston

aglio = require( 'aglio' )
path = require( 'path' )
winston = require( 'winston' )

destination = path.join( __dirname + '/../views/docs.hbs' )
options = {
  themeVariables: 'flatly'
}
source = path.join( __dirname + '/../docs/src/index.apib' )

console.log( source )
console.log( destination )

aglio.renderFile( source, destination, options, function ( error, warnings ) {
  if ( error ) {
    return winston.error( error )
  }

  if ( warnings ) {
    winston.warn( warnings )
  }
})
