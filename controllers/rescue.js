var Rescue, rescue, save;





Rescue = require( '../models/rescue' );
ErrorModels = require( '../errors' );
rescue = new Rescue;





// GET
// =============================================================================
exports.get = function ( request, response ) {
  var id, responseModel;

  responseModel = {
    links: {
      self: request.originalUrl
    }
  };

  console.log( 'Fresh:', request.fresh );

  if ( id = request.params.id ) {
    Rescue.findById( id, function ( error, rescue ) {
      var status;

      if ( error ) {
        responseModel.errors = [];
        responseModel.errors.push( error );
        status = 400;

      } else {
        responseModel.data = rescue;
        status = 200;
      }

      response.status( status );
      response.json( responseModel );
    });

  } else {
    Rescue.find( request.query, function ( error, rescues ) {
      var status;

      if ( error ) {
        responseModel.errors = [];
        responseModel.errors.push( error );
        status = 400;

      } else {
        responseModel.data = rescues;
        status = 200;
      }

      response.status( status );
      response.json( responseModel );
    });
  }
};





// POST
// =============================================================================
exports.post = function ( request, response ) {
  var responseModel;

  responseModel = {
    links: {
      self: request.originalUrl
    }
  };

  for ( var key in request.body ) {
    rescue[key] = request.body[key];
  }

  rescue.save( function ( error, rescue ) {
    var errors, errorTypes, status;

    if ( error ) {
      errorTypes = Object.keys( error.errors );
      responseModel.errors = [];

      for ( var i = 0; i < errorTypes.length; i++ ) {
        var error, errorModel, errorType;

        errorType = errorTypes[i];
        error = error.errors[errorType].properties;

        if ( error.type === 'required' ) {
          errorModel = ErrorModels['missing_required_field'];
        }

        errorModel.detail = 'You\'re missing the required field: ' + error.path;

        responseModel.errors.push( errorModel );
      }

      status = 400;

    } else {
      responseModel.data = rescue;
      status = 201;
    }

    response.status( status );
    response.json( responseModel );
  });

  return rescue;
};





// PUT
// =============================================================================
exports.put = function ( request, response ) {
  var responseModel, status;

  responseModel = {
    links: {
      self: request.originalUrl
    }
  };

  if ( id = request.params.id ) {
    Rescue.findById( id, function ( error, rescue ) {
      if ( error ) {
        responseModel.errors = responseModel.errors || [];
        responseModel.errors.push( error );
        status = 400;

      } else if ( !rescue ) {
        responseModel.errors.push({
          message: 'Couldn\'t find a rescue with _id', id
        });
        status = 404;
      };

      if ( responseModel.errors.length ) {
        response.status( status );
        response.json( responseModel );
        return;
      }

      for ( var key in request.body ) {
        rescue[key] = request.body[key]
      }

      rescue.increment();
      rescue.save( function ( error, rescue ) {
        var errors, errorTypes, status;

        if ( error ) {

          errorTypes = Object.keys( error.errors );
          responseModel.errors = [];

          for ( var i = 0; i < errorTypes.length; i++ ) {
            var error, errorModel, errorType;

            errorType = errorTypes[i];
            error = error.errors[errorType].properties;

            if ( error.type === 'required' ) {
              errorModel = ErrorModels['missing_required_field'];
            }

            errorModel.detail = 'You\'re missing the required field: ' + error.path;

            responseModel.errors.push( errorModel );
          }

          status = 400;

        } else {
          responseModel.data = rescue;
          status = 201;
        }

        response.status( status );
        response.json( responseModel );
      });
    });
  } else {
    response.status( 400 );
    response.send();
  }

  return rescue;
};





// SEARCH
// =============================================================================
exports.search = function ( request, response ) {
  var query;

  query = {
    $text: {
      $search: request.params.query
    }
  };

  scoring = {
    score: {
      $meta: 'textScore'
    }
  };

  Rescue
  .find( query, scoring )
  .sort( scoring )
  .limit( 10 )
  .exec( function ( error, rescues ) {
    if ( error ) {
      console.log( Object.keys( error ) )
      return response.send( error );
    }

    response.json( rescues );
  });
};
