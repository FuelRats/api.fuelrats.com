var _,
    csv,
    download,
    downloads,
    destination,
    filename,
    fs,
    mongoose,
    processRats,
    processRescues,
    Rat,
    ratSheet,
    removeArchives,
    winston





// Node Modules
_ = require( 'underscore' )
csv = require( 'csv' )
download = require( 'download' )
fs = require( 'fs' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )

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





processRats = function ( ratData, rescueDrills, dispatchDrills ) {
  winston.info( 'Processing rats' )

  return new Promise( function ( resolve, reject ) {
    var rats

    rats = []

    ratData.forEach( function ( ratDatum, index, ratData ) {
      var dispatchDrill, rat, rescueDrill

      rat = {
        archive: true,
        drilled: {
          dispatch: false,
          rescue: false
        },
        joined: new Date( ratDatum[0] ) || new Date,
        rescues: []
      }

      if ( dispatchDrill = _.findWhere( dispatchDrills, { 3: ratDatum[2] } ) ) {
        rat.drilled.dispatch = dispatchDrill[4].toLowerCase() === 'pass'
      }

      if ( rescueDrill = _.findWhere( rescueDrills, { 3: ratDatum[2] } ) ) {
        rat.drilled.rescue = rescueDrill[4].toLowerCase() === 'pass'
      }

      if ( ratDatum[1] === 'CMDR' || ratDatum[1] === 'GameTag' ) {
        rat.CMDRname = ratDatum[2]
      }

      if ( ratDatum[1] === 'GameTag' ) {
        rat.platform = 'xb'
      }

      if ( rat.CMDRname ) {
        rats.push( Rat.create( rat ) )
      }
    })

    Promise.all( rats )
    .then( resolve )
    .catch( reject )
  })
}





processRescues = function ( rescuesData ) {
  winston.info( 'Processing rescues' )

  return new Promise( function ( resolve, reject ) {
    var rescues

    rescues = []

    rescuesData.forEach( function ( rescueDatum, index, rescuesData ) {
      var rescue

      rescue = {
        archive: true,
        createdAt: new Date( rescueDatum[0] ),
        notes: rescueDatum[4],
        open: false,
        rats: [],
        unidentifiedRats: [rescueDatum[1]],
        successful: rescueDatum[3].toLowerCase() === 'successful' ? true : false,
        system: rescueDatum[2]
      }

      rescues.push( Rescue.create( rescue ) )
    })

    Promise.all( rescues )
    .then( resolve )
    .catch( reject )
  })
}





removeArchives = function removeArchives ( models ) {
  winston.info( 'Removing archives' )

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
winston.info( 'Downloading spreadsheets' )
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
        winston.info( 'Parsing spreadsheet:', name )
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

        winston.info( 'Created', newRatCount, 'rats,', oldRatCount, 'total' )
        winston.info( 'Created', newRescuesCount, 'rescues,', oldRescuesCount, 'total' )

        mongoose.disconnect()
      })
      .catch( function ( error ) {
        winston.error( error )
      })
    })
    .catch( function ( error ) {
      winston.error( error )
    })
  })
  .catch( function ( error ) {
    winston.error( error )
  })
})
.catch( function ( error ) {
  winston.error( error )
})
