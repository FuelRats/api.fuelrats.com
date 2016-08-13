var _,
    csv,
    download,
    downloads,
    destination,
    filename,
    fs,
    processRats,
    processRescues,
    linkRatsAndRescues,
    Rat,
    ratSheet,
    Rescue,
    removeArchives,
    User,
    util,
    winston



// Node Modules
_ = require( 'underscore' )
csv = require( 'csv' )
download = require( 'download' )
fs = require( 'fs' )
//mongoose = require( 'seq' )
winston = require( 'winston' )

// Mongoose Models
Rat = require('../api/db').Rat
User = require('../api/db').User

util = require('util')


let logFile = fs.createWriteStream('data/importlog.log', { flags: 'w' })

function logToFile(string) {
  logFile.write(string + '\n')
}


//mongoose.Promise = global.Promise
//mongoose.set( 'debug', false )
//https://docs.google.com/spreadsheets/d/1_e0kJcMqjzoDfB2qRPYRIdR3naeEA19Y-ZzmYHo6yzE/edit#gid=84232353
// Google Sheet URLs
spreadsheets = {
  /*rats: {
    workbookId: '1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc',
    sheetId: '445147052'
  },
  rescues: {
    workbookId: '1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc',
    sheetId: '1657880365'
  },*/
  rescueDrilledRats: {
    //workbookId: '1_e0kJcMqjzoDfB2qRPYRIdR3naeEA19Y-ZzmYHo6yzE',
    workbookId: '1m17twk6jn2E9AJ2UrqEjizUYC1tAI9En7CxAEOL_30w',
    sheetId: '0'
  },
  dispatchDrilledRats: {
    //workbookId: '1_e0kJcMqjzoDfB2qRPYRIdR3naeEA19Y-ZzmYHo6yzE',
    workbookId: '1m17twk6jn2E9AJ2UrqEjizUYC1tAI9En7CxAEOL_30w',
    sheetId: '1076276737'
  }/*,
  epicRescues: {
    workbookId: '1SUm4Ls-pHTDwmCobyrLFp1FGWv2_Dtbda99nXjEuo9M',
    sheetId: '498743399'
  }*/
}

// Config options
destinationFolder = 'data'

// Array to store our download promises in
downloads = []

//mongoose.connect( 'mongodb://localhost/fuelrats' )


processRats = function ( rescueDrills, dispatchDrills ) {
  winston.info( 'Processing rats' )

  return new Promise( function ( resolve, reject ) {
    var rats

    rats = []

    rescueDrills.forEach( function ( rescueDatum, index, rescueDrillData ) {
      let rat = {
        CMDRname: rescueDatum[3].replace(/cmdr /i,'').trim(),
        passed: rescueDatum[4] == 'Pass',
        drillDate: new Date (rescueDatum[0]) || new Date,
      }

      if(!rat.passed) { 
        return
      }

      rats.push(new Promise(function (resolve, reject) {

        let query = {
          where: {
            CMDRname: rat.CMDRname
          }
        }
        Rat.findAndCountAll(query)
        .then(function(results) {
          let meta = {
            count: results.rows.length,
            total: results.count
          }

          if(meta.count == 0) {
            logToFile(rat.CMDRname)
          }

          let rats = results.rows.map(function (ratInstance) {
            let _rat = ratInstance.toJSON()
            User.findAndCountAll({
              where: {
                id: _rat.UserId
              }
            }).then(function (uresults) {
              let users = uresults.rows.map(function (userInstance) {
                let usr = userInstance.toJSON()
                usr.drilled = rat.passed
                User.update(usr, { where: { id: usr.id }})
              })
            })
            return rat
          })

          resolve({
            data: rats,
            meta: meta
          })
        })
      }))      
    })

    dispatchDrills.forEach( function ( rescueDatum, index, rescueDrillData ) {
      let rat = {
        CMDRname: rescueDatum[3].replace(/cmdr /i,'').trim(),
        passed: rescueDatum[4] == 'Pass',
        drillDate: new Date (rescueDatum[0]) || new Date,
      }

      if(!rat.passed) { 
        return
      }

      rats.push(new Promise(function (resolve, reject) {

        let query = {
          where: {
            CMDRname: rat.CMDRname
          }
        }
        Rat.findAndCountAll(query)
        .then(function(results) {
          let meta = {
            count: results.rows.length,
            total: results.count
          }

          if(meta.count == 0) {
            logToFile(rat.CMDRname)
          }

          let rats = results.rows.map(function (ratInstance) {
            let _rat = ratInstance.toJSON()
            User.findAndCountAll({
              where: {
                id: _rat.UserId
              }
            }).then(function (uresults) {
              let users = uresults.rows.map(function (userInstance) {
                let usr = userInstance.toJSON()
                usr.drilledDispatch = rat.passed
                User.update(usr, { where: { id: usr.id }})
              })
            })
            return rat
          })

          resolve({
            data: rats,
            meta: meta
          })
        })
      }))      
    })

    /*ratData.forEach( function ( ratDatum, index, ratData ) {
      var dispatchDrill, rat, rescueDrill

      rat = {
        archive: true,
        drilled: {
          dispatch: false,
          rescue: false
        },
        joined: new Date( ratDatum[0] ) || new Date,
        platform: 'pc',
        rescues: []
      }

      if ( dispatchDrill = _.findWhere( dispatchDrills, { 3: ratDatum[2], 4: 'Pass' } ) ) {
        rat.drilled.dispatch = true;
      }

      if ( rescueDrill = _.findWhere( rescueDrills, { 3: ratDatum[2], 4: 'Pass' } ) ) {
        rat.drilled.rescue = true
      }

      if ( ratDatum[1] === 'CMDR' || ratDatum[1] === 'GameTag' ) {
        rat.CMDRname = ratDatum[2].replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim()
      }

      if ( ratDatum[1] === 'GameTag' ) {
        rat.platform = 'xb'
      }

      if ( rat.CMDRname ) {
        rats.push( new Promise( function ( resolve, reject ) {

          let dbQuery = {
            where: {
              CMDRname: rat.CMDRname,
              platform: rat.platform
            }
          }

          Rat.findAndCountAll(dbQuery)
          .then( function ( rats ) {
            console.log(rats)
            return
            if ( !rats.length ) {
              new Rat( rat )
              .save()
              .then( resolve )
              .catch( reject )
            } else {
              resolve()
            }
          })
          .catch( reject )
        }))
      }
    })*/

    winston.info('Importing %d rats!', rats.length)

    Promise.all( rats )
    .then( resolve )
    .catch( reject )
  })
}





/*processRescues = function ( rescuesData ) {
  winston.info( 'Processing rescues' )

  return new Promise( function ( resolve, reject ) {
    var rescues

    rescues = []

    rescuesData.forEach( function ( rescueDatum, index, rescuesData ) {
      var rescue

      rescue = {
        client: {},
        archive: true,
        createdAt: new Date( rescueDatum[0] ),
        notes: rescueDatum[4].trim(),
        platform: 'pc',
        open: false,
        rats: [],
        name: null,
        firstLimpet: null,
        unidentifiedRats: [rescueDatum[1].replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim()],
        successful: rescueDatum[3].toLowerCase() === 'successful' ? true : false,
        system: rescueDatum[2].trim()
      }

       rescues.push(mongoose.models.Rat.findOneAndUpdate(
        {
            $text: {
                $search: rescueDatum[1].replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
                $caseSensitive: false,
                $diacriticSensitive: false
            }
        },
        {
            $set: {
                CMDRname: rescueDatum[1].replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
                archive: true,
                drilled: {
                  dispatch: false,
                  rescue: false
                },
                joined: new Date( rescueDatum[0] ) || new Date,
                rescues: []
            }
        },
        { upsert: true }
      ));

      rescues.push( new Rescue( rescue ).save() )
    })
    Promise.all( rescues )
    .then( resolve )
    .catch( reject )
  })
}*/

removeArchives = function removeArchives ( models ) {
  winston.info( 'Removing archives' )

  return new Promise( function ( resolve, reject ) {
    var promises

    promises = []

    models.forEach( function ( model, index, models ) {
      promises.push( model.remove( { archive: true } ) )
    })
    winston.info('Removing %d archived models!', promises.length)
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
  var dispatchDrills, promises, removals, rescueDrills, epicRescueRats

  promises = []

  dispatchDrills = spreadsheets.dispatchDrilledRats.data
  //rats = spreadsheets.rats.data
  //rescues = spreadsheets.rescues.data
  rescueDrills = spreadsheets.rescueDrilledRats.data
  //epicRescueRats = spreadsheets.epicRescues.data;

  //rats.shift()
  //rescues.shift()

  dispatchDrills.shift()
  rescueDrills.shift()

  //epicRescueRats.shift();

  // Clear out the archives
/*
  removeArchives( [ Rat, Rescue ] )
  .then( function () {
    var promises

    promises = []
*/
    processRats( rescueDrills, dispatchDrills )
    /*.then( function () {
      return processRescues( rescues )
    })*/
    .then( function () {
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

                //mongoose.disconnect()

            })
            .catch( winston.error )

      })
      .catch( winston.error )
    })
    .catch( winston.error )
  })
  .catch( winston.error )
//})
//.catch( winston.error )
