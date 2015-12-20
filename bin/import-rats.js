var csv, download, destination, filename, fs, mongoose, Rat, ratSheet





csv = require( 'csv' )
download = require( 'download' )
fs = require( 'fs' )
mongoose = require( 'mongoose' )

Rat = require( '../api/models/rat' )
Rescue = require( '../api/models/rescue' )

destination = 'data'
filename = 'rats.csv'
url = 'https://docs.google.com/spreadsheets/d/1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc/export?gid=445147052&format=csv'

mongoose.Promise = global.Promise





mongoose.connect( 'mongodb://localhost/fuelrats' )
Rat.remove( { archive: true }, function ( error ) {
  if ( error ) {
    console.log( error )
    return
  }

  console.log( 'removed all archived rats' )
  console.log( 'downloading archive' )

  download()
  .get( url )
  .dest( destination )
  .rename( filename )
  .run( function ( error ) {
    if ( error ) {
      console.log( error )
      return
    }

    console.log( 'parsing archive' )

    csv.parse( fs.readFileSync( destination + '/' + filename ), function ( error, rats ) {
      var promises, ratsAdded, ratsCount

      promises = []

      if ( error ) {
        console.log( error )
        return
      }

      rats.shift()
      rats.forEach( function ( ratData, index, rats ) {
        var rat

        rat = {
          archive: true,
          joined: parseInt( new Date( ratData[0] || new Date ).getTime() / 1000 ),
          rescues: []
        }

        if ( ratData[1] === 'CMDR' ) {
          rat.CMDRname = ratData[2]
        } else if ( ratData[1] === 'GameTag' ) {
          rat.gamertag = ratData[2]
        }

        promises.push( new Promise( function ( resolve, reject ) {
          Rescue.find( { rats: rat.CMDRname } )
          .then( function ( rescues ) {
            rescues.forEach( function ( rescue, index, rescues ) {
              rat.rescues.push( rescue._id )
            })

            Rat.create( rat )
            .then( function ( rat ) {
              console.log( 'created', ( rat.CMDRname || rat.gamertag ), 'with', rat.rescues.length, 'rescues' )
              resolve( rat )
            })
            .catch( function ( error ) {
              console.log( 'error creating rat', ( rat.CMDRname || rat.gamertag ) )
              console.log( error )

              reject( error )
            })
          })
          .catch( function ( error ) {
            console.log( 'error retrieving rescues for', ( rat.CMDRname || rat.gamertag ) )
            console.log( error )

            reject( error )
          })
        }))
      })

      Promise.all( promises )
      .then( function () {
        fs.unlinkSync( destination + '/' + filename )

        Rat.count( {}, function ( error, count ) {
          console.log( '' )
          console.log( 'added ' + ( rats.length - 1 ) + ' archived rats' )
          console.log( count + ' total rats' )
          mongoose.disconnect()
        })
      })
    })
  })
})
