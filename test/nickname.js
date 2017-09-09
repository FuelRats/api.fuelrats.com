'use strict'
// Imports
// =============================================================================

let chai = require('chai')
let request = require('supertest')
let assert = chai.assert

// Set up globals
// =============================================================================

let rootUrl = 'http://localhost:8080'
request = request(rootUrl)
let cookie

// Before and After hooks
// =============================================================================

describe('Login Test', function () {
  it('should create user session for valid user', function (done) {
    this.timeout(10000)
    request.post('/login')
      .set('Accept','application/json')
      .send({'email': 'support@fuelrats.com', 'password': 'testuser'})
      .expect(200)
      .expect('set-cookie', /connect.sid/)
      .end(function (err, response) {
        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        assert.equal(response.body.data.email, 'support@fuelrats.com')
        // Save the cookie to use it later to retrieve the session
        cookie = response.headers['set-cookie']
        done()
      })
  })
})

  describe('GET /nicknames/search', function () {

    it('should retrieve a list of users matching the IRC nickname', function (done) {
      request.get('/nicknames/search/testnick[PC]')
        .set('Cookie', cookie).send()
        .expect(200).end(function (error, response) {
          if (error) {
            return done(error)
          }

          // Make sure there are no errors
          assert.notProperty(response.body, 'errors')

          // Make sure our response is correctly constructed
          assert.isArray(response.body.data)

          assert.isArray(response.body.data[0].nicknames)
          assert.equal(response.body.data[0].nicknames[0], 'testnick')
          done()
        }
      )
    })
  })