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
  var links, rescueFinds, saves

  winston.info( 'Linking models' )

  links = 0
  ratFinds = []
  saves = []

  return new Promise( function ( resolve, reject ) {
    Rescue.find({})
    .then( function ( rescues ) {
      rescues.forEach( function ( rescue, index, rescues ) {
        var ratFind

        ratFind = Rat.find({
          CMDRname: rescue.unidentifiedRats[0],
          platform: rescue.platform
        })

        ratFind.then( function ( rats ) {
          var rat

          if ( rats.length ) {
            rat = rats[0]

            rat.rescues.push( rescue._id )
            rescue.rats.push( rat._id )

            links += 1

            saves.push( rat.save() )
            saves.push( rescue.save() )
          }
        })

        ratFinds.push( ratFind )
      })

      Promise.all( ratFinds )
      .then( function () {
        Promise.all( saves )
        .then( function () {
          resolve( links )
        })
        .catch( reject )
      })
      .catch( reject )
    })
    .catch( reject )
  })
}

linkModels()
.then( function ( links ) {
  winston.info( 'Completed ' + links + ' links' )
  mongoose.disconnect()
})
.catch( winston.error )
