var _, csv, download, downloads, destination, filename, fs, linkModels, moment, mongoose, processRats, processRescues, Rat, ratSheet, removeArchives, winston





// Node Modules
_ = require( 'underscore' )
csv = require( 'csv' )
download = require( 'download' )
fs = require( 'fs' )
moment = require( 'moment' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )
require( 'mongoose-moment' )( mongoose )

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





linkModels = function () {
  var linkedRatsCount, linkedRescuesCount, ratFind

  winston.info( 'Linking models' )

  linkedRatsCount = 0
  linkedRescuesCount = 0

  return new Promise( function ( resolve, reject ) {
    Rat.find({})
    .then( function ( rats ) {
      var rescueFinds

      rescueFinds = []

      rats.forEach( function ( rat, index, rats ) {
        rescueFinds.push( Rescue.find( { tempRats: rat.CMDRname } ) )
      })

      Promise.all( rescueFinds )
      .then( function ( results ) {
        var saves

        saves = []

        results.forEach( function ( rescues, index, results ) {
          var rat

          rat = rats[index]

          if ( rescues.length ) {
            linkedRatsCount = linkedRatsCount + 1

            rescues.forEach( function ( rescue, index, rescues ) {
              linkedRescuesCount = linkedRescuesCount + 1

              winston.info( 'Linking rat', rat.CMDRname, 'to rescue', rescue._id )

              rescue.tempRats = []
              rescue.rats.push( rat._id )
              rat.rescues.push( rescue._id )
              saves.push( rescue.save() )
              saves.push( rat.save() )
            })
          }
        })

        winston.info( saves.length )
        Promise.all( saves )
        .then( function () {
          winston.info( 'done!' )
          resolve( linkedRatsCount, linkedRescuesCount )
        })
        .catch( reject )
      })
      .catch( reject )
    })
    .catch( reject )
  })
}





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
        joined: moment( new Date( ratDatum[0] ) || new Date ),
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
        rats.push( rat )
      }
    })

    Rat.collection.insert( rats, function ( error, rats ) {
      if ( error ) {
        return reject( error )
      }

      resolve()
    })
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
        createdAt: moment( new Date( rescueDatum[0] ) ),
        notes: rescueDatum[4],
        open: false,
        rats: [],
        tempRats: [rescueDatum[1]],
        successful: rescueDatum[3].toLowerCase() === 'successful' ? true : false,
        system: rescueDatum[2]
      }

      rescues.push( rescue )
    })

    Rescue.collection.insert( rescues, function ( error ) {
      if ( error ) {
        return reject( error )
      }

      resolve ()
    })
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

    processRats( rats, rescueDrills, dispatchDrills )
    .then( processRescues( rescues ) )
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

        linkModels()
        .then( function ( linkedRatsCount, linkedRescuesCount ) {
          winston.info( 'Created', newRatCount, 'rats,', oldRatCount, 'total' )
          winston.info( 'Created', newRescuesCount, 'rescues,', oldRescuesCount, 'total' )
          winston.info( 'Linked', linkedRescuesCount, 'rescues to', linkedRatsCount, 'rats' )

          mongoose.disconnect()
        }).catch(function(error) {
            winston.error(error)
            mongoose.disconnect()
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
})
.catch( function ( error ) {
  winston.error( error )
})
