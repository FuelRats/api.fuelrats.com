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





// POST
// =============================================================================
exports.post = function ( request, response, next ) {
  var finds, firstLimpetFind

  finds = []

  // Validate and update rats
  if ( typeof request.body.rats === 'string' ) {
    request.body.rats = request.body.rats.split( ',' )
  }

  request.body.unidentifiedRats = []

  request.body.rats.forEach( function ( rat, index, rats ) {
    var find, CMDRname

    if ( typeof rat === 'string' ) {
      if ( !mongoose.Types.ObjectId.isValid( rat ) ) {
        CMDRname = rat.trim()

        request.body.rats = _.without( request.body.rats, CMDRname )

        find = Rat.findOne({
          CMDRname: CMDRname
        })

        find.then( function ( rat ) {
          if ( rat ) {
            request.body.rats.push( rat._id )
          } else {
            request.body.unidentifiedRats.push( CMDRname )
          }
        })

        finds.push( find )
      }

    } else if ( typeof rat === 'object' && rat._id ) {
      request.body.rats.push( rat._id )
    }
  })

  // Validate and update firstLimpet
  if ( typeof request.body.firstLimpet === 'string' ) {
    if ( !mongoose.Types.ObjectId.isValid( request.body.firstLimpet ) ) {
      firstLimpetFind = Rat.findOne({
        CMDRname: request.body.firstLimpet.trim()
      })

      firstLimpetFind.then( function ( rat ) {
        if ( rat ) {
          request.body.firstLimpet = rat._id
        }
      })

      finds.push( firstLimpetFind )
    }

  } else if ( typeof request.body.firstLimpet === 'object' && request.body.firstLimpet._id ) {
    request.body.firstLimpet = request.body.firstLimpet._id
  }

  Promise.all( finds )
  .then( function () {
    console.log( request.body )

    Rescue.create( request.body, function ( error, rescue ) {
      var errors, errorTypes, status

      if ( error ) {
        response.model.errors.push( error )
        response.status( 400 )

      } else {
        response.model.data = rescue
        response.status( 201 )
      }

      next()
    })
  })

//    if ( referer = request.get( 'Referer' ) ) {
//      response.redirect( '/login' )
//
//    } else {
//      response.status( status )
//      response.json( response.model )
//    }
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
            response.model.errors.push( error )
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
