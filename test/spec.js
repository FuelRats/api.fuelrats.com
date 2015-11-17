var chai, expect, randomRescue, rootUrl, superagent;

chai = require( 'chai' );
superagent = require( 'superagent' );
expect = chai.expect;

rootUrl = 'http://localhost:8080/api';
randomRescue = function () {
  randomName = 'Client ' + (Date.now() * Math.random()).toFixed();
  return {
    CMDRname: 'CMDR ' + randomName,
    codeRed: Math.round( Math.random() ), // Randomly decide if this is a code red
    nearestSystem: 'Eravate',
    nickname: randomName,
    platform: Math.round( Math.random() ) ? 'PC' : 'XB' // Randomly decide if the client is PC or Xbox
  }
};

describe( 'api.fuelrats.com', function () {
  var rescue = randomRescue();

  // Create a new rescue for testing against
  before( function ( done ) {
    superagent
    .post( rootUrl + '/rescues' )
    .send( rescue )
    .end( function ( error, response ) {
      rescue.id = response.body.data.id;
      done();
    });
  });

  describe( '/api/rescues', function () {
    describe( 'GET', function () {
      it( 'should return a list of rescues', function ( done ) {
        superagent
        .get( rootUrl + '/rescues' )
        .end( function ( error, response ) {
          expect( response.body ).to.not.have.property( 'errors' );
          expect( response.body.data ).to.be.an( 'array' );
          done();
        });
      });
    });

    //describe( 'PUT', function () {
    //  it( 'should not be allowed', function ( done ) {
    //    superagent
    //    .put( rootUrl + '/rescues' )
    //    .end( function ( error, response ) {
    //      expect( response.status ).to.equal( 405 );
    //      done();
    //    });
    //  });
    //});
  });

  describe( '/api/rescues/:id', function () {
    describe( 'GET', function () {
      it( 'should return a single rescue', function ( done ) {
        superagent
        .get( rootUrl + '/rescues/' + rescue.id )
        .end( function ( error, response ) {
          if ( error ) {
            done();
          }

          expect( response.body ).to.not.have.property( 'errors' );
          expect( response.body ).to.have.property( 'data' );
          expect( response.body.data ).to.have.property( 'id' );
          //expect( response.body.data.id ).to.equal( rescue.id );
          done();
        });
      });
    });
  });
});
