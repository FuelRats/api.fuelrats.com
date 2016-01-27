var _, moment, path, Rat, Rescue, winston





_ = require( 'underscore' )
moment = require( 'moment' )
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
              console.log( 'createdAt', rescue.createdAt )
              console.log( 'lastModified', rescue.lastModified )
              rescue.createdAt = moment( rescue.createdAt )
              rescue.lastModified = moment( rescue.lastModified )
            })

            CMDR.rescues = _.sortBy( CMDR.rescues, 'createdAt' ).reverse()

            resolve( rescues )
          })
        }))
      })

      Promise.all( rescueFinds )
      .then( function () {
        request.user.rescues = []

        request.user.CMDRs.forEach( function ( CMDR, index, CMDRs ) {
          _.union( request.user, CMDR.rescues )
        })

        response.render( 'welcome', request.user )
      })
      .catch( function ( error ) {
        winston.error( error )
      })
    })
  }
}
