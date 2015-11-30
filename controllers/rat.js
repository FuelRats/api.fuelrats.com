var Rat, rat;

Rat = require( '../models/rat' );
rat = new Rat;

exports.post = function ( request, response, respond ) {
  if ( !respond ) {
    respond = true;
  }

  console.log( Rat );

  for ( var key in request.body ) {
    rat[key] = request.body[key]
  }

  rat.save( function ( error ) {
    var errors, errorTypes, ret;

    if ( error ) {
      errors = error['errors'];
      errorTypes = Object.keys( errors );
      ret = [];

      for ( var i = 0; i < errorTypes.length; i++ ) {
        var errorType = errorTypes[i];

        ret.push( errors[errorType].message );
      }

      response.status( 406 );
      response.json( ret );

    } else if ( respond ) {
      response.json( rat );
    }
  });

  return rat;
};

exports.get = function ( request, response ) {
  var id;

  if ( id = request.params.id ) {
    Rat.findById( id, function ( error, rat ) {
      if ( error ) {
        response.send( error );
      }

      response.json( rat );
    });

  } else {
    Rat.find( request.body, function ( error, rats ) {
      if ( error ) {
        response.send( error );
      }

      response.json( rats );
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

  Rat
  .find( query, scoring )
  .sort( scoring )
  .limit( 10 )
  .exec( function ( error, rats ) {
    if ( error ) {
      console.log( Object.keys( error ) )
      return response.send( error );
    }

    response.json( rats );
  });
};
