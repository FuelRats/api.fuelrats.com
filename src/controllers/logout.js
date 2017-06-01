var ErrorModels





ErrorModels = require( '../errors' )





exports.post = function ( request, response ) {
  var error, referer, responseModel, status

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  if ( request.isAuthenticated() ) {
    request.logout()
    responseModel.data = {
      success: true
    }
    status = 200

  } else {
    error = ErrorModels.not_authenticated
    responseModel.errors = [error]
    status = error.code
  }

  if ( referer = request.get( 'Referer' ) ) {
      response.redirect( '/login' )

  } else {
    response.status( status )
    response.json( responseModel )
  }
}
