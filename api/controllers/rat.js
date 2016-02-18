var _, ErrorModels, Rat, rat, Rescue, save, winston





_ = require( 'underscore' )
winston = require( 'winston' )
Rat = require( '../models/rat' )
Rescue = require( '../models/rescue' )
ErrorModels = require( '../errors' )





// GET
// =============================================================================
exports.get = function ( request, response, next ) {
  exports.view( request.body ).then( function( res ) {
    var data = res.data
    var meta = res.meta

    response.model.data = data
    response.model.meta = meta
    response.status = 400
    next()
  }, function( error ) {
    response.model.errors.push( error.error )
    response.status( 400 )
  })
}





// GET (by ID)
// =============================================================================
exports.getById = function ( request, response, next ) {
  var id

  response.model.meta.params = _.extend( response.model.meta.params, request.params )
  console.log( response.model.meta.params )

  id = request.params.id

  Rat
  .findById( id )
  .populate( 'rescues' )
  .exec( function ( error, rat ) {
    var status

    if ( error ) {
      response.model.errors.push( error )
      response.status( 400 )

    } else {
      response.model.data = rat
      response.status( 200 )
    }

    next()
  })
}


exports.view = function ( query ) {
  return new Promise(function(resolve, reject) {
    var filter, dbQuery

    filter = {}
    dbQuery = {}

    filter.size = parseInt( query.limit ) || 25
    delete query.limit

    filter.from = parseInt( query.offset ) || 0
    delete query.offset

    for ( var key in query ) {
      if ( key === 'q' ) {
        dbQuery.query_string = {
          query: query.q
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

    Rat.search( dbQuery, filter, function ( error, dbData ) {
      var rescueFinds

      rescueFinds = []

      if ( error ) {
        var errorObj = ErrorModels.server_error
        errorObj.detail = error
        reject({error: errorObj, meta: {}})

      } else {
        var meta = {
          count: dbData.hits.hits.length,
          limit: filter.size,
          offset: filter.from,
          total: dbData.hits.total
        }
        var data = []

        dbData.hits.hits.forEach( function ( rat, index, rats ) {
          var ratToPopulate, rescueFind

          rat._source._id = rat._id
          rat._source.score = rat._score


          data.push( rat._source )
          rescueFinds.push( rescueFind )
        })

        resolve({ data: data, meta: meta})
      }
    })
  })
}


// POST
// =============================================================================
exports.post = function ( request, response, next ) {
  Rat.create( request.body, function ( error, rat ) {
    var errors, errorTypes, status

    if ( error ) {
      errorTypes = Object.keys( error.errors )

      for ( var i = 0; i < errorTypes.length; i++ ) {
        var error, errorModel, errorType

        errorType = errorTypes[i]
        error = error.errors[errorType].properties

        if ( error.type === 'required' ) {
          errorModel = ErrorModels['missing_required_field']
        }

        errorModel.detail = 'You\'re missing the required field: ' + error.path

        response.model.errors.push( errorModel )
      }

      winston.error( error )
      response.status( 400 )

    } else {
      response.model.data = rat
      response.status( 201 )
    }

    next()

//    if ( referer = request.get( 'Referer' ) ) {
//      response.redirect( '/login' )
//
//    } else {
//      response.status( status )
//      response.json( response.model )
//    }
  })
}





// PUT
// =============================================================================
exports.put = function ( request, response, next ) {
  var status

  response.model.meta.params = _.extend( response.model.meta.params, request.params )

  if ( id = request.params.id ) {
    Rat.findById( id, function ( error, rat ) {
      if ( error ) {
        response.model.errors.push( error )
        response.status( 400 )

        next()

      } else if ( !rat ) {
        response.model.errors.push( ErrorModels.not_found )
        response.status( 404 )

        next()

      } else {
        for ( var key in request.body ) {
          if ( key === 'client' ) {
            _.extend( rat.client, request.body[key] )
          } else {
            rat[key] = request.body[key]
          }
        }

        rat.save( function ( error, rat ) {
          var errors, errorTypes, status

          if ( error ) {
            errorTypes = Object.keys( error.errors )

            for ( var i = 0; i < errorTypes.length; i++ ) {
              var error, errorModel, errorType

              errorType = errorTypes[i]
              error = error.errors[errorType].properties

              if ( error.type === 'required' ) {
                errorModel = ErrorModels['missing_required_field']
              }

              errorModel.detail = 'You\'re missing the required field: ' + error.path

              response.model.errors.push( errorModel )
            }

            status = 400

          } else {
            status = 200
            response.model.data = rat
          }

          next()
        })
      }
    })
  } else {
    response.model.errors.push( ErrorModels.missing_required_field )
    response.status( 400 )

    next()
  }
}
