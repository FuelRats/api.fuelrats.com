var _, csv, download, downloads, destination, filename, fs, mongoose, processRats, processRescues, Rat, ratSheet, removeArchives





// Node Modules
_ = require( 'underscore' )
csv = require( 'csv' )
download = require( 'download' )
fs = require( 'fs' )
mongoose = require( 'mongoose' )

// Mongoose Models
Rat = require( '../api/models/rat' )
Rescue = require( '../api/models/rescue' )

mongoose.Promise = global.Promise

// Google Sheet URLs
spreadsheets = {
  rats: {
    workbookId: '1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc',
    sheetId: '445147052'
  },
  rescues: {
    workbookId: '1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc',
    sheetId: '1657880365'
  },
  rescueDrilledRats: {
    workbookId: '1_e0kJcMqjzoDfB2qRPYRIdR3naeEA19Y-ZzmYHo6yzE',
    sheetId: '72806282'
  },
  dispatchDrilledRats: {
    workbookId: '1_e0kJcMqjzoDfB2qRPYRIdR3naeEA19Y-ZzmYHo6yzE',
    sheetId: '84232353'
  }
}

// Config options
destinationFolder = 'data'

// Array to store our download promises in
downloads = []

mongoose.connect( 'mongodb://localhost/fuelrats' )





processRats = function ( rats, rescueDrills, dispatchDrills ) {
  console.log( 'Processing rats' )

  return new Promise( function ( resolve, reject ) {
    var promises

    promises = []

    rats.forEach( function ( ratData, index, rats ) {
      var dispatchDrill, rat, rescueDrill

      rat = {
        archive: true,
        drilled: {
          dispatch: false,
          rescue: false
        },
        joined: parseInt( new Date( ratData[0] || new Date ).getTime() / 1000 ),
        rescues: []
      }

      if ( dispatchDrill = _.findWhere( dispatchDrills, { 3: ratData[2] } ) ) {
        rat.drilled.dispatch = dispatchDrill[4].toLowerCase() === 'pass'
      }

      if ( rescueDrill = _.findWhere( rescueDrills, { 3: ratData[2] } ) ) {
        rat.drilled.rescue = rescueDrill[4].toLowerCase() === 'pass'
      }

      if ( ratData[1] === 'CMDR' ) {
        rat.CMDRname = ratData[2]
      } else if ( ratData[1] === 'GameTag' ) {
        rat.gamertag = ratData[2]
      }

      if ( rat.CMDRname || rat.gamertag ) {
        promises.push( new Promise( function ( resolve, reject ) {
          Rescue.find( { rats: rat.CMDRname } )
          .then( function ( rescues ) {
            rescues.forEach( function ( rescue, index, rescues ) {
              rat.rescues.push( rescue._id )
            })

            Rat.create( rat )
            .then( function ( rat ) {
              resolve( rat )
            })
            .catch( function ( error ) {
              console.error( 'error creating rat', ( rat.CMDRname || rat.gamertag ) )
              console.error( error )

              reject( error )
            })
          })
          .catch( function ( error ) {
            console.error( 'error retrieving rescues for', ( rat.CMDRname || rat.gamertag ) )
            console.error( error )

            reject( error )
          })
        }))
      }
    })

    Promise.all( promises )
    .then( resolve )
    .catch( reject )
  })
}





processRescues = function ( rescues ) {
  console.log( 'Processing rescues' )

  return new Promise( function ( resolve, reject ) {
    var promises

    promises = []

    rescues.forEach( function ( rescueData, index, rescues ) {
      var rescue

      rescue = {
        archive: true,
        createdAt: new Date( rescueData[0] ).getTime() / 1000,
        notes: rescueData[4],
        open: false,
        rats: [rescueData[1]],
        successful: rescueData[3] === 'Successful' ? true : false,
        system: rescueData[2]
      }

      promises.push( Rescue.create( rescue ) )
    })

    Promise.all( promises )
    .then( resolve )
    .catch( reject )
  })
}





removeArchives = function removeArchives ( models ) {
  console.log( 'Removing archives' )

  return new Promise( function ( resolve, reject ) {
    var promises

    promises = []

    models.forEach( function ( model, index, models ) {
      promises.push( model.remove( { archive: true } ) )
    })

    Promise.all( promises )
    .then( resolve )
    .catch( reject )
  })
}





// Download all of the spreadsheets
console.log( 'Downloading spreadsheets' )
Object.keys( spreadsheets ).forEach( function ( name, index, names ) {
  var url, spreadsheet

  spreadsheet = spreadsheets[name]
  url = 'https://docs.google.com/spreadsheets/d/' + spreadsheet.workbookId + '/export?gid=' + spreadsheet.sheetId + '&format=csv'

  downloads.push( new Promise( function ( resolve, reject ) {
    download()
    .get( url )
    .dest( destinationFolder )
    .rename( name + '.csv' )
    .run( function ( error ) {
      if ( error ) {
        reject( error )
      } else {
        console.log( 'Parsing spreadsheet:', name )
        csv.parse( fs.readFileSync( destinationFolder + '/' + name + '.csv' ), function ( error, data ) {
          if ( error ) {
            reject( error )
          } else {
            spreadsheets[name].data = data
            resolve()
          }
        })
      }
    })
  }))
})





Promise.all( downloads )
.then( function () {
  var dispatchDrills, promises, rats, removals, rescues, rescueDrills

  promises = []

  dispatchDrills = spreadsheets.dispatchDrilledRats.data
  rats = spreadsheets.rats.data
  rescues = spreadsheets.rescues.data
  rescueDrills = spreadsheets.rescueDrilledRats.data

  rats.shift()
  rescues.shift()

  // Clear out the archives
  removeArchives( [ Rat, Rescue ] )
  .then( function () {
    var promises

    promises = []

    promises.push( processRats( rats, rescueDrills, dispatchDrills ) )
    promises.push( processRescues( rescues ) )

    Promise.all( promises )
    .then( function () {
      var promises

      promises = []

      promises.push( Rat.count({}) )
      promises.push( Rescue.count({}) )

      Promise.all( promises )
      .then( function ( results ) {
        var newRatCount, newRescuesCount, oldRatCount, oldRescuesCount

        newRatCount = rats.length
        newRescuesCount = rescues.length
        oldRatCount = results[0]
        oldRescuesCount = results[1]

        console.log( 'Created', newRatCount, 'rats,', oldRatCount, 'total' )
        console.log( 'Created', newRescuesCount, 'rescues,', oldRescuesCount, 'total' )

        mongoose.disconnect()
      })
      .catch( function ( error ) {
        console.error( error )
      })
    })
    .catch( function ( error ) {
      console.error( error )
    })
  })
  .catch( function ( error ) {
    console.error( error )
  })
})
.catch( function ( error ) {
  console.error( error )
})
