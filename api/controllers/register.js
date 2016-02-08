var _, passport, path, Rat, rat, User, user





_ = require( 'underscore' )
passport = require( 'passport' )
path = require( 'path' )

Rat = require( '../models/rat.js' )
User = require( '../models/user.js' )





exports.get = function ( request, response ) {
  response.redirect( '/login' )
}





exports.post = function ( request, response, next ) {
  var CMDRfind, gamertagFind, promises, ratData

  promises = []

  user = new User({
    email: request.body.email.trim()
  })

  if ( request.body.CMDRname ) {
    CMDRfind = Rat.findOne({
      CMDRname: request.body.CMDRname.trim()
    })

    CMDRfind.then( function ( rat ) {
      var ratCreate

      if ( rat ) {
        user.CMDRs.push( rat._id )
      } else {
        ratCreate = Rat.create({
          CMDRname: request.body.CMDRname.trim()
        })

        ratCreate.then( function ( rat ) {
          user.CMDRs.push( rat._id )
        })

        promises.push( ratCreate )
      }
    })

    promises.push( CMDRfind )
  }

  if ( request.body.gamertag ) {
    gamertagFind = Rat.findOne({
      CMDRname: request.body.gamertag.trim(),
      platform: 'xb'
    })

    gamertagFind.then( function ( rat ) {
      var ratCreate

      if ( rat ) {
        user.CMDRs.push( rat._id )
      } else {
        ratCreate = Rat.create({
          CMDRname: request.body.gamertag.trim(),
          platform: 'xb'
        })

        ratCreate.then( function ( rat ) {
          user.CMDRs.push( rat._id )
        })

        promises.push( ratCreate )
      }
    })

    promises.push( gamertagFind )
  }

  Promise.all( promises )
  .then( function () {
    User.register( user, request.body.password, function ( error, user ) {
      var auth, saves

      saves = []

      if ( error ) {
        response.send( error )
        return
      }

      user.CMDRs.forEach( function ( CMDR, index, CMDRs ) {
        if ( CMDR.archive ) {
          CMDR.archive = false
          saves.push( CMDR.save() )
        }
      })

      Promise.all( saves )
      .then( function () {
        auth = passport.authenticate( 'local' )

        auth( request, response, function () {
          var referer, status

          if ( error ) {
            response.model.errors = []
            response.model.errors.push( error )
            response.status( 400 )

          } else {
            user.rat = rat
            response.model.data = user
            response.status( 200 )
          }

          next()
        })
      })
      .catch( function ( error ) {
        console.error( error )
      })
    })
  })
}
