var _, ErrorModels, Rescue, rescue, save, winston





_ = require( 'underscore' )
winston = require( 'winston' )
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

  Rescue.search( query, filter, function ( error, data ) {
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

      data.hits.hits.forEach( function ( rescue, index, rescues ) {
        var rescueToPopulate, rescueFind

        rescue._source._id = rescue._id
        rescue._source.score = rescue._score

        response.model.data.push( rescue._source )
      })

      response.status( 200 )
    }

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





// POST
// =============================================================================
exports.post = function ( request, response, next ) {
  Rescue.create( request.body, function ( error, rescue ) {
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
      response.model.data = rescue
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
    Rescue.findById( id, function ( error, rescue ) {
      if ( error ) {
        response.model.errors.push( error )
        response.status( 400 )

        next()

      } else if ( !rescue ) {
        response.model.errors.push( ErrorModels.not_found )
        response.status( 404 )

        next()

      } else {
        for ( var key in request.body ) {
          if ( key === 'client' ) {
            _.extend( rescue.client, request.body[key] )
          } else {
            rescue[key] = request.body[key]
          }
        }

        rescue.save( function ( error, rescue ) {
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
            response.model.data = rescue
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
