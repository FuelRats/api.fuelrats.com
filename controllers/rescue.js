var Rescue, rescue, save, swaggerMongoose;

Rescue = require( '../models/rescue' );
swaggerMongoose = require('swagger-mongoose');
rescue = new Rescue;

save = function ( entity, response ) {
  var ret, status;

  entity.save( function ( error, entity ) {
    var errors, errorTypes;

    if ( error ) {
      errors = error['errors'];
      errorTypes = Object.keys( errors );
      ret = [];

      for ( var i = 0; i < errorTypes.length; i++ ) {
        var errorType = errorTypes[i];

        ret.push( errors[errorType].message );
      }

      status = 406;
      ret = ret;

    } else {
      status = 201;
      ret = entity;
    }

    response.status( status );
    response.json( ret );
  });
};

exports.post = function ( request, response, respond ) {
  var saveResponse;

  if ( !respond ) {
    respond = true;
  }

  for ( var key in request.body ) {
    rescue[key] = request.body[key]
  }

  save( rescue, response );

  return rescue;
};

exports.put = function ( request, response, respond ) {
  var saveResponse;

  if ( id = request.params.id ) {
    Rescue.findById( id, function ( error, rescue ) {
      if ( error ) {
        response.status( 404 );
        response.send( error );
      }

      for ( var key in request.body ) {
        rescue[key] = request.body[key]
      }

      save( rescue, response );
    });
  }

  return rescue;
};

exports.get = function ( request, response ) {
  var id;

  console.log( request.fresh );

  if ( id = request.params.id ) {
    Rescue.findById( id, function ( error, rescue ) {
      if ( error ) {
        response.send( error );
      }

      response.json( rescue );
    });

  } else {
    Rescue.find( request.query, function ( error, rescues ) {
      if ( error ) {
        response.send( error );
      }

      response.json( rescues );
    });
  }
};

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
