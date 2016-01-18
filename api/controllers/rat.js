var Rat, rat, save





Rat = require( '../models/rat' )
ErrorModels = require( '../errors' )





// GET
// =============================================================================
exports.get = function ( request, response ) {
  var filter, id, query, responseModel

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  if ( id = request.params.id ) {
    Rat
    .findById( id )
    .exec( function ( error, rat ) {
      var status

      if ( error ) {
        responseModel.errors = []
        responseModel.errors.push( error )
        status = 400

      } else {
        responseModel.data = rat
        status = 200
      }

      response.status( status )
      response.json( responseModel )
    })

  } else {
    filter = {}
    query = {}
    responseModel = {
      links: {
        self: request.originalUrl
      }
    }

    filter.size = request.body.limit || 25
    delete request.body.limit

    filter.from = request.body.offset || 0
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

    Rat.search( query, function ( error, data ) {
      if ( error ) {
        responseModel.errors = []
        responseModel.errors.push( error )
        status = 400
      } else {
        responseModel.meta = {
          count: data.hits.hits.length,
          limit: filter.size,
          offset: filter.from,
          total: data.hits.hits.length
        }
        responseModel.data = []
        data.hits.hits.forEach( function ( hit, index, hits ) {
          responseModel.data.push( hit._source )
        })
        status = 200
      }

      response.status( status )
      response.json( responseModel )
    })
  }
}





// POST
// =============================================================================
exports.post = function ( request, response ) {
  var responseModel

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  Rat.create( request.body, function ( error, rat ) {
    var errors, errorTypes, status

    if ( error ) {
      errorTypes = Object.keys( error.errors )
      responseModel.errors = []

      for ( var i = 0; i < errorTypes.length; i++ ) {
        var error, errorModel, errorType

        errorType = errorTypes[i]
        error = error.errors[errorType].properties

        if ( error.type === 'required' ) {
          errorModel = ErrorModels['missing_required_field']
        }

        errorModel.detail = 'You\'re missing the required field: ' + error.path

        responseModel.errors.push( errorModel )
      }

      console.log( 'failed', error )
      status = 400

    } else {
      responseModel.data = rat
      status = 201
    }

    response.status( status )
    response.json( responseModel )
  })

  return rat
}





// PUT
// =============================================================================
exports.put = function ( request, response ) {
  var responseModel, status

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }

  if ( id = request.params.id ) {
    Rat.findById( id, function ( error, rat ) {
      if ( error ) {
        responseModel.errors = responseModel.errors || []
        responseModel.errors.push( error )
        response.status( 400 )
        response.json( responseModel )
        return

      } else if ( !rat ) {
        response.status( 404 ).send()
        return
      }

      for ( var key in request.body ) {
        rat[key] = request.body[key]
      }

      rat.increment()
      rat.save( function ( error, rat ) {
        var errors, errorTypes, status

        if ( error ) {

          errorTypes = Object.keys( error.errors )
          responseModel.errors = []

          for ( var i = 0; i < errorTypes.length; i++ ) {
            var error, errorModel, errorType

            errorType = errorTypes[i]
            error = error.errors[errorType].properties

            if ( error.type === 'required' ) {
              errorModel = ErrorModels['missing_required_field']
            }

            errorModel.detail = 'You\'re missing the required field: ' + error.path

            responseModel.errors.push( errorModel )
          }

          status = 400

        } else {
          status = 200
          responseModel.data = rat
        }

        response.status( status )
        response.json( responseModel )
      })
    })
  } else {
    response.status( 400 )
    response.send()
  }

  return rat
}





// SEARCH
// =============================================================================
exports.search = function ( request, response ) {
  var query, responseModel, scoring

  responseModel = {
    links: {
      self: request.originalUrl
    }
  }
  scoring = {}

  if ( request.params.query ) {
    query = {
      $text: {
        $search: request.params.query
      }
    }

    scoring.score = {
      $meta: 'textScore'
    }
  } else {
    query = request.body
  }

  Rat
  .find( query, scoring )
  .sort( scoring )
  .limit( 10 )
  .exec( function ( error, rats ) {
    if ( error ) {
      responseModel.errors = []
      responseModel.errors.push( error )
      status = 400
    } else {
      responseModel.data = rats
      status = 200
    }

    response.status( status )
    response.json( responseModel )
  })
}
