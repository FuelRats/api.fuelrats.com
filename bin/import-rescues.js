var csv, download, destination, filename, fs, mongoose, Rescue, rescueSheet;





csv = require( 'csv' );
download = require( 'download' );
fs = require( 'fs' );
mongoose = require( 'mongoose' );

Rescue = require( '../models/rescue' );

destination = 'data';
filename = 'rescues.csv';
url = 'https://docs.google.com/spreadsheets/d/1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc/export?gid=1657880365&format=csv';





mongoose.connect( 'mongodb://localhost/fuelrats' );
Rescue.remove( { archive: true }, function ( error ) {
  if ( error ) {
    console.log( error );
    return;
  }

  console.log( 'removed all rescues' );

  download()
  .get( url )
  .dest( destination )
  .rename( filename )
  .run( function ( error ) {
    if ( error ) {
      console.log( error );
      return;
    }

    csv.parse( fs.readFileSync( destination + '/' + filename ), function ( error, data ) {
      var rescuesAdded, rescuesCount;

      rescuesAdded = 0;
      rescuesCount = data.length - 1;

      if ( error ) {
        console.log( error );
        return;
      }

      for ( var i = 0; i < rescuesCount; i++ ) {
        var rescue, rescueData;

        rescueData = data[i];
        rescue = {
          archive: true,
          closed: true,
          createdAt: new Date( rescueData[0] ),
          notes: rescueData[4],
          rats: [rescueData[1]],
          successful: rescueData[3] === 'Successful' ? true : false,
          system: rescueData[2]
        };

        Rescue.create( rescue, function ( error, rescue ) {
          if ( error ) {
            console.log( 'error creating rescue' );
            console.log( error );
            return;
          }

          rescuesAdded = rescuesAdded + 1;

          console.log( 'created rescue', rescuesAdded );

          if ( rescuesAdded === rescuesCount ) {
            Rescue.count( {}, function ( error, count ) {
              console.log( '' );
              console.log( 'added ' + rescuesCount + ' archived rescues' );
              console.log( count + ' total rescues' )
              mongoose.disconnect();
            })
          }
        });
      }
    });
  });
});
