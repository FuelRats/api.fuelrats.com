var _, path, Rat, Rescue, winston





_ = require( 'underscore' )
path = require( 'path' )
winston = require( 'winston' )

Rat = require( '../models/rat' )
Rescue = require( '../models/rescue' )





exports.get = function ( request, response ) {
  if ( request.isUnauthenticated() ) {
    response.redirect( '/login' )

  } else {
    request.user.populate( 'CMDRs', function( error ) {
      var rescueFinds

      rescueFinds = []

      if ( error ) {
        return winston.error( error )
      }

      request.user.CMDRs.forEach( function ( CMDR, index, CMDRs ) {
        rescueFinds.push( new Promise( function ( resolve, reject ) {
          CMDR.populate( 'rescues', function ( error, rescues ) {
            if ( error ) {
              return reject( error )
            }

            CMDR.rescues.forEach( function ( rescue, index, rescues ) {
              rescue.createdAt = rescue.createdAt * 1000
              rescue.lastModified = rescue.lastModified * 1000
            })

            resolve( rescues )
          })
        }))
      })

      Promise.all( rescueFinds )
      .then( function () {
        winston.info( 'finished finding rescues' )

        request.user.CMDRs.forEach( function ( CMDR, index, CMDRs ) {
          winston.info( CMDR.rescues )
        })

        response.render( 'welcome', request.user )
      })
      .catch( function ( error ) {
        winston.error( error )
      })
    })
  }
}
