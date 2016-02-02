var _,
    linkModels,
    mongoose,
    Rat,
    Rescue,
    winston





// Node Modules
_ = require( 'underscore' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )

// Mongoose Models
Rat = require( '../api/models/rat' )
Rescue = require( '../api/models/rescue' )

mongoose.Promise = global.Promise

mongoose.connect( 'mongodb://localhost/fuelrats' )





linkModels = function () {
  var linkedRatsCount, linkedRescuesCount, ratFind

  winston.info( 'Linking models' )

  linkedRatsCount = 0
  linkedRescuesCount = 0

  return new Promise( function ( resolve, reject ) {
    var rescueFinds, saves

    rescueFinds = []
    saves = []

    Rat.find({})
    .then( function ( rats ) {
      rats.forEach( function ( rat, index, rats ) {
        rescueFinds.push( new Promise( function ( resolve, reject ) {
          Rescue.find({
            platform: rat.platform,
            unidentifiedRats: rat.CMDRname
          })
          .then( function ( rescues ) {
            rescues.forEach( function ( rescue, index, rescues ) {
              rat.rescues.push( rescue._id )
              rescue.rats.push( rat._id )
              rescue.unidentifiedRats = _.without( rescue.unidentifiedRats, rat.CMDRname )
//              rescue.firstLimpet = rat._id

              linkedRescuesCount += 1

              saves.push( rescue.save() )
            })

            if ( rescues.length ) {
              linkedRatsCount += 1
              saves.push( rat.save() )
            }

            resolve()
          })
          .catch( reject )
        }))
      })

      Promise.all( rescueFinds )
      .then( function ( results ) {
        Promise.all( saves )
        .then( function ( results ) {
          resolve({
            rats: linkedRatsCount,
            rescues: linkedRescuesCount
          })
        })
        .catch( reject )
      })
      .catch( reject )
    })
    .catch( reject )
  })
}

linkModels()
.then( function ( linked ) {
  winston.info( 'Linked ' + linked.rats + ' rats to ' + linked.rescues + ' rescues' )
  mongoose.disconnect()
})
.catch( winston.error )
