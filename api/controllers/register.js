var _, passport, path, Rat, rat, User, user





_ = require( 'underscore' )
passport = require( 'passport' )
path = require( 'path' )

Rat = require( '../models/rat.js' )
User = require( '../models/user.js' )





exports.get = function ( request, response ) {
  response.redirect( '/login' )
}





exports.post = function ( request, response ) {
  var finds, ratData

  finds = []

  user = new User({
    email: request.body.email
  })

  if ( request.body.CMDRname ) {
    finds.push( Rat.find({
      CMDRname: request.body.CMDRname
    }))
  }

  if ( request.body.gamertag ) {
    finds.push( Rat.find({
      gamertag: request.body.gamertag
    }))
  }

  Promise.all( finds )
  .then( function ( results ) {
    if ( results.length ) {
      results.forEach( function ( result, index, results ) {
        if ( result.length ) {
          user.CMDRs.push( result[0] )
        }
      })
    }

    if ( request.body.CMDRname && _.findWhere( user.CMDRs, { CMDRname: request.body.CMDRname } ) ) {
      user.CMDRs.push( new Rat({
        CMDRname: request.body.CMDRname
      }))
    }

    if ( request.body.gamertag && _.findWhere( user.CMDRs, { gamertag: request.body.gamertag } ) ) {
      user.CMDRs.push( new Rat({
        gamertag: request.body.gamertag
      }))
    }

    User.register( user, request.body.password, function ( error, user ) {
      var auth, saves

      saves = []

      if ( error ) {
        response.send( error )
        return
      }

      user.CMDRs.forEach( function ( CMDR, index, CMDRs ) {
        if ( CMDR._id ) {
          saves.push( CMDR.save() )

        } else {
          saves.push( Rat.create( CMDR ) )
        }
      })

      Promise.all( saves )
      .then( function () {
        auth = passport.authenticate( 'local' )

        auth( request, response, function () {
          var referer, responseModel, status

          responseModel = {
            links: {
              self: request.originalUrl
            }
          }

          if ( error ) {
            responseModel.errors = []
            responseModel.errors.push( error )
            status = 400

          } else {
            user.rat = rat
            responseModel.data = user
            status = 200
          }

          if ( referer = request.get( 'Referer' ) ) {
            response.redirect( '/login' )

          } else {
            response.status( status )
            response.json( responseModel )
          }
        })
      })
    })
  })
}
