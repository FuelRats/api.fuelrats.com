var csv, download, destination, filename, fs, mongoose, Rat, ratSheet;





csv = require( 'csv' );
download = require( 'download' );
fs = require( 'fs' );
mongoose = require( 'mongoose' );

Rat = require( '../models/rat' );

destination = 'data';
filename = 'rats.csv';
url = 'https://docs.google.com/spreadsheets/d/1JoTrC3TmBNFkEtU6lWcGhOZkUaRr9YUY24kLA5LQnoc/export?gid=445147052&format=csv';





mongoose.connect( 'mongodb://localhost/fuelrats' );
Rat.remove( { archive: true }, function ( error) {
  if ( error ) {
    console.log( error );
    return;
  }

  console.log( 'removed all archived rats' );

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
      var ratsAdded, ratsCount;

      ratsAdded = 0;
      ratsCount = data.length - 1;

      if ( error ) {
        console.log( error );
        return;
      }

      for ( var i = 1; i < data.length; i++ ) {
        var rat, ratData;

        ratData = data[i];
        rat = {
          archive: true,
          joined: new Date( ratData[0] )
        };

        if ( ratData[1] === 'CMDR' ) {
          rat.CMDRname = ratData[2];
        } else if ( ratData[1] === 'GameTag' ) {
          rat.gamertag = ratData[2];
        }

        Rat.create( rat, function ( error, rat ) {
          if ( error ) {
            console.log( 'error creating rat' );
            console.log( error );
            return;
          }

          ratsAdded = ratsAdded + 1;

          console.log( 'created', ( rat.CMDRname || rat.gamertag ), rat.id );

          if ( ratsAdded === ratsCount ) {
            Rat.count( {}, function ( error, count ) {
              console.log( '' );
              console.log( 'added ' + ratsCount + ' archived rats' );
              console.log( count + ' total rats' )
              mongoose.disconnect();
            })
          }
        });
      }
    });
  });
});
