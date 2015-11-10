var Rescue, rescue;

Rescue = require( '../models/rescue' );
rescue = new Rescue

exports.post = function ( request, response, respond ) {
  if ( !respond ) {
    respond = true;
  }

  for ( var key in request.body ) {
    rescue[key] = request.body[key]
  }

  rescue.save( function ( error ) {
    var errors, errorTypes, ret;

    if ( error ) {
      errors = error['errors'];
      errorTypes = Object.keys( errors );
      ret = [];

      for ( var i = 0; i < errorTypes.length; i++ ) {
        var errorType = errorTypes[i];

        ret.push( errors[errorType].message );
      }

      response.status( 406 )
      response.json( ret );

    } else if ( respond ) {
      response.json( rescue );
    }
  });

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
