var _, ErrorModels, Rat, rat, save, winston





_ = require( 'underscore' )
winston = require( 'winston' )
Rat = require( '../models/rat' )
ErrorModels = require( '../errors' )





// GET
// =============================================================================
exports.get = function ( request, response ) {
  var filter, id, query

  response.model.meta.params = _.extend( response.model.meta.params, request.params )

  if ( id = request.params.id ) {
    Rat
    .findById( id )
    .exec( function ( error, rat ) {
      var status

      if ( error ) {
        response.model.errors = []
        response.model.errors.push( error )
        status = 400

      } else {
        response.model.data = rat
        status = 200
      }

      response.status( status )
      response.json( response.model )
    })

  } else {
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
      if ( error ) {
        response.model.errors = []
        response.model.errors.push( error )
        status = 400

      } else {
        response.model.meta = {
          count: data.hits.hits.length,
          limit: filter.size,
          offset: filter.from,
          total: data.hits.total
        }
        response.model.data = []

        data.hits.hits.forEach( function ( hit, index, hits ) {
          hit._source._id = hit._id
          hit._source.score = hit._score
          response.model.data.push( hit._source )
        })
        status = 200
      }

      response.status( status )
      response.json( response.model )
    })
  }
}





// POST
// =============================================================================
exports.post = function ( request, response ) {
  Rat.create( request.body, function ( error, rat ) {
    var errors, errorTypes, status

    if ( error ) {
      errorTypes = Object.keys( error.errors )
      response.model.errors = []

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
      status = 400

    } else {
      response.model.data = rat
      status = 201
    }

    if ( referer = request.get( 'Referer' ) ) {
      response.redirect( '/login' )

    } else {
      response.status( status )
      response.json( response.model )
    }
  })

  return rat
}





// PUT
// =============================================================================
exports.put = function ( request, response ) {
  var status

  response.model.meta.params = _.extend( response.model.meta.params, request.params )

  if ( id = request.params.id ) {
    Rat.findById( id, function ( error, rat ) {
      if ( error ) {
        response.model.errors = response.model.errors || []
        response.model.errors.push( error )
        response.status( 400 )
        return response.json( response.model )

      } else if ( !rat ) {
        return response.status( 404 ).send()
      }

      for ( var key in request.body ) {
        if ( key === 'client' ) {
          _.extend( rat.client, request.body[key] )
        } else {
          rat[key] = request.body[key]
        }
      }

//      rat.increment()
      rat.save( function ( error, rat ) {
        var errors, errorTypes, status

        if ( error ) {

          errorTypes = Object.keys( error.errors )
          response.model.errors = []

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

        response.status( status )
        response.json( response.model )
      })
    })
  } else {
    response.status( 400 )
    response.send()
  }

  return rat
}
