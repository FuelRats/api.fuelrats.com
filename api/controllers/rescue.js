var _, ErrorModels, handleError, mongoose, Rat, Rescue, rescue, save, winston





_ = require( 'underscore' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )

Rat = require( '../models/rat' )
Rescue = require( '../models/rescue' )
ErrorModels = require( '../errors' )





// SHARED FUNCTIONS
// =============================================================================
handleError = function ( error ) {
  errorTypes = Object.keys( error.errors )

  console.error( errorTypes )

  for ( var i = 0; i < errorTypes.length; i++ ) {
    var errorModel, errorType

    errorType = errorTypes[i]
    error = error.errors[errorType].properties

    if ( error.type === 'required' ) {
      errorModel = ErrorModels['missing_required_field']
    }

    errorModel.detail = 'You\'re missing the required field: ' + error.path

    response.model.errors.push( errorModel )
  }
}

// GET
// =============================================================================
exports.get = function ( request, response, next ) {

  exports.read( request.body ).then( function( res ) {
    var data = res.data
    var meta = res.meta

    response.model.data = data
    response.model.meta = meta
    response.status = 400
    next()
  }, function( error ) {
    response.model.errors.push( error.error )
    response.status( 400 )
    next()
  })
}





// GET (by ID)
// =============================================================================
exports.getById = function ( request, response, next ) {
  var id

  response.model.meta.params = _.extend( response.model.meta.params, request.params )
  console.log( response.model.meta.params )

  id = request.params.id

  Rescue
  .findById( id )
  .populate( 'rats' )
  .exec( function ( error, rescue ) {
    var status

    if ( error ) {
      response.model.errors.push( error )
      response.status( 400 )

    } else {
      response.model.data = rescue
      response.status( 200 )
    }

    next()
  })
}


exports.read = function ( query ) {
  return new Promise(function (resolve, reject) {
    var filter

    filter = {}
    dbQuery = {}

    filter.size = parseInt( query.limit ) || 25
    delete query.limit

    filter.from = parseInt( query.offset ) || 0
    delete query.offset

    for ( var key in query ) {
      if ( key === 'q' ) {
        dbQuery.query_string = {
          query: request.body.q
        }
      } else {
        if ( !dbQuery.bool ) {
          dbQuery.bool = {
            should: []
          }
        }

        term = {}
        term[key] = {
          query: query[key],
          fuzziness: 'auto'
        }
        dbQuery.bool.should.push( { match: term } )
      }
    }

    if ( !Object.keys( dbQuery ).length ) {
      dbQuery.match_all = {}
    }

    Rescue.search( dbQuery, filter, function ( error, queryData ) {
      if ( error ) {
        reject( { error: error, meta: {} } )

      } else {
        var meta = {
          count: queryData.hits.hits.length,
          limit: filter.size,
          offset: filter.from,
          total: queryData.hits.total
        }

        var data = []

        queryData.hits.hits.forEach( function ( rescue, index, rescues ) {
          var rescueToPopulate, rescueFind

          rescue._source._id = rescue._id
          rescue._source.score = rescue._score

          data.push( rescue._source )
        })

        resolve( { data: data, meta: meta } )
      }
    })
  })
}



// POST
// =============================================================================
exports.post = function ( request, response, next ) {
  exports.create( request.body ).then(function( res ) {
    console.log('done')
    response.model.data = res.data
    response.status( 201 )
    next()
  }, function( error ) {
    console.log('erroring')
    response.model.errors.push( error )
    response.status( 400 )
    next()
  })
}

exports.create = function( query ) {
  return new Promise(function(resolve, reject) {
    console.log('0')
    var finds, firstLimpetFind

    finds = []

    console.log(query)
    // Validate and update rats
    if ( typeof query.rats === 'string' ) {
      query.rats = query.rats.split( ',' )
    }

    query.unidentifiedRats = []


    if ( query.rats ) {
      query.rats.forEach( function ( rat, index, rats ) {
        var find, CMDRname

        if ( typeof rat === 'string' ) {
          if ( !mongoose.Types.ObjectId.isValid( rat ) ) {
            CMDRname = rat.trim()

            query.rats = _.without( query.rats, CMDRname )

            find = Rat.findOne({
              CMDRname: CMDRname
            })

            find.then( function ( rat ) {
              if ( rat ) {
                query.rats.push( rat._id )
              } else {
                query.unidentifiedRats.push( CMDRname )
              }
            })

            finds.push( find )
          }

        } else if ( typeof rat === 'object' && rat._id ) {
          query.rats.push( rat._id )
        }
      })
    }

    // Validate and update firstLimpet
    if ( query.firstLimpet ) {
      if ( typeof query.firstLimpet === 'string' ) {
        if ( !mongoose.Types.ObjectId.isValid( query.firstLimpet ) ) {
          firstLimpetFind = Rat.findOne({
            CMDRname: query.firstLimpet.trim()
          })

          firstLimpetFind.then( function ( rat ) {
            if ( rat ) {
              query.firstLimpet = rat._id
            }
          })

          finds.push( firstLimpetFind )
        }

      } else if ( typeof query.firstLimpet === 'object' && query.firstLimpet._id ) {
        query.firstLimpet = query.firstLimpet._id
      }
    }
    console.log(finds)
    Promise.all( finds )
    .then( function () {

      Rescue.create( query, function ( error, rescue ) {
        var errors

        if ( error ) {
          reject( { error: error, meta: {} } )

        } else {
          resolve ( { data: rescue, meta: {} } )
        }
      })
    })
  })
}



// PUT
// =============================================================================
exports.put = function ( request, response, next ) {
  var status

  response.model.meta.params = _.extend( response.model.meta.params, request.params )

  exports.update( request.params, request.body ).then(function( data ) {
    response.model.data = data
    response.status( 201 )
    next()
  }, function( error ) {
    response.model.errors.push( error )

    var status = error.code || 400
    response.status( status )
    next()
  })
}

exports.update = function( query, changes ) {
  return new Promise(function(resolve, reject) {
    if ( query.id ) {
      Rescue.findById( query.id, function ( error, rescue ) {
        if ( error ) {
          reject( { error: error, meta: {} } )

        } else if ( !rescue ) {
          reject( { error: ErrorModels.not_found, meta: {} } )

        } else {
          for ( var key in changes ) {
            if ( key === 'client' ) {
              _.extend( rescue.client, changes[key] )
            } else {
              rescue[key] = changes[key]
            }
          }

          rescue.save( function ( error, rescue ) {
            var errors

            if ( error ) {
              reject( { error: error, meta: {} } )

            } else {
              resolve( { data: data, meta: {} } )
            }
          })
        }
      })
    }
  })
}
