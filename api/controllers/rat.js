var _, ErrorModels, Rat, rat, Rescue, save, winston





_ = require( 'underscore' )
winston = require( 'winston' )
Rat = require( '../models/rat' )
Rescue = require( '../models/rescue' )
ErrorModels = require( '../errors' )





// GET
// =============================================================================
exports.get = function ( request, response, next ) {
  var filter, query

  filter = {}
  query = {}

  filter.size = parseInt( request.body.limit ) || 25
  delete request.body.limit

  filter.from = parseInt( request.body.offset ) || 0
  delete request.body.offset

  for ( var key in request.body ) {
    if ( key === 'q' ) {
      query.query_string = {
        query: request.body.q
      }
    } else {
      if ( !query.bool ) {
        query.bool = {
          should: []
        }
      }

      term = {}
      term[key] = {
        query: request.body[key],
        fuzziness: 'auto'
      }
      query.bool.should.push( { match: term } )
    }
  }

  if ( !Object.keys( query ).length ) {
    query.match_all = {}
  }

  Rat.search( query, filter, function ( error, data ) {
    var rescueFinds

    rescueFinds = []

    if ( error ) {
      response.model.errors.push( error )
      response.status( 400 )

    } else {
      response.model.meta = {
        count: data.hits.hits.length,
        limit: filter.size,
        offset: filter.from,
        total: data.hits.total
      }
      response.model.data = []

      data.hits.hits.forEach( function ( rat, index, rats ) {
        var ratToPopulate, rescueFind

        rat._source._id = rat._id
        rat._source.score = rat._score

//        rescueFind = Rescue.find({
//          platform: rat._source.platform,
//          rats: rat._source.CMDRname
//        })

        response.model.data.push( rat._source )

//        rescueFind.then( function ( rescues ) {
//          rat._source.rescues = rescues
//        })

        rescueFinds.push( rescueFind )
      })

      response.status( 200 )
    }

//    Promise.all( rescueFinds )
//    .then( next )
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

  Rat
  .findById( id )
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
