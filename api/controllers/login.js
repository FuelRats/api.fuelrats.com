var _, path, Rat, Rescue, winston





_ = require( 'underscore' )
path = require( 'path' )
winston = require( 'winston' )

Rat = require( '../models/rat' )
Rescue = require( '../models/rescue' )





exports.get = function ( request, response ) {
  if ( request.isUnauthenticated() ) {
    response.render( 'login' )
  } else {
    Rat.findById( request.user.rat )
    .exec( function ( error, rat ) {
      var rescues

      rescues = []

      rescues.push( Rescue.find( { rats: rat.CMDRname } ) )
      rescues.push( Rescue.find( { rats: rat.gamertag } ) )

      Promise.all( rescues )
      .then( function ( results ) {
        rat.rescues = _.union( results[0], results[1] )
        request.user.rat = rat
        response.render( 'welcome', request.user )
//        winston.info( )
      })
      .catch( winston.error )
    })
  }
}





exports.post = function ( request, response ) {
  var referer, responseModel

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

    if ( referer = request.get( 'Referer' ) ) {
      response.redirect( '/login' )

    } else {
      response.status( status )
      response.json( responseModel )
    }
  })
}
