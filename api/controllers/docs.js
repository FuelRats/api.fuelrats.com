exports.get = function ( request, response ) {
  response.render( 'docs', {
    layout: false
  }, function ( error, html ) {
    if ( error ) {
      return response.send( 'Unable to find documentation. Please consult the included README' )
    }

    response.send( html )
  })
}
