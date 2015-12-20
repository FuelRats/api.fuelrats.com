var csv, download, destination, filename, fs, mongoose, Rescue, rescueSheet





csv = require( 'csv' )
download = require( 'download' )
fs = require( 'fs' )
mongoose = require( 'mongoose' )

Rescue = require( '../api/models/rescue' )

destination = 'data'
filename = 'rescues.csv'
url = 'https://docs.google.com/spreadsheets/d/1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc/export?gid=1657880365&format=csv'

mongoose.Promise = global.Promise





mongoose.connect( 'mongodb://localhost/fuelrats' )
Rescue.remove( { archive: true }, function ( error ) {
  if ( error ) {
    console.log( error )
    return
  }

  console.log( 'removed all rescues' )
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

    csv.parse( fs.readFileSync( destination + '/' + filename ), function ( error, rescues ) {
      var rescuesAdded, rescuesCount

      promises = []

      if ( error ) {
        console.log( error )
        return
      }

      rescues.shift()
      rescues.forEach( function ( rescue, index, rescues ) {
        rescue = {
          archive: true,
          closed: true,
          createdAt: new Date( rescue[0] ).getTime() / 1000,
          notes: rescue[4],
          rats: [rescue[1]],
          successful: rescue[3] === 'Successful' ? true : false,
          system: rescue[2]
        }

        promises.push( new Promise( function ( resolve, reject ) {
          Rescue.create( rescue )
          .then( function ( rescue ) {
            console.log( 'created rescue', index )
            resolve( rescue )
          })
          .catch( function ( error ) {
            console.log( 'error creating rescue' )
            console.log( error )

            reject( error )
          })
        }))
      })

      Promise.all( promises )
      .then( function () {
        fs.unlinkSync( destination + '/' + filename )

        Rescue.count( {}, function ( error, count ) {
          console.log( '' )
          console.log( 'added ' + ( rescues.length - 1 ) + ' archived rescues' )
          console.log( count + ' total rescues' )
          mongoose.disconnect()
        })
      })
    })
  })
})
