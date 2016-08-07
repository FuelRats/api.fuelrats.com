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

// PULL THE LEVER!
// =============================================================================

describe('Client Endpoints', function () {
  describe('POST /clients', function () {
    // Create a rescue object
    let client = {
      name: 'Unit Test Client'
    }

    it('should create a new client', function (done) {
      this.timeout(10000)
      request.post('/clients')
      .set('Cookie', cookie)
      .send(client)
      .expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data.name, client.name)
        assert.typeOf(response.body.data.id, 'string')
        assert.lengthOf(response.body.data.id, 36)
        assert.typeOf(response.body.data.secret, 'string')
        assert.lengthOf(response.body.data.secret, 48)
        done()
      })
    })
  })

  let clientId

  describe('GET /clients', function () {

    it('should retrieve a collection of clients', function (done) {
      request.get('/clients?name=Unit%20Test%20Client')
      .set('Cookie', cookie).send()
      .expect(200).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isArray(response.body.data)

        assert.equal(response.body.data[0].name, 'Unit Test Client')
        clientId = response.body.data[0].id
        done()
      })
    })
  })

  describe('DELETE /clients', function () {

    it('should retrieve a collection of clients', function (done) {
      request.delete('/clients/' + clientId)
      .set('Cookie', cookie).send()
      .expect(204).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.equal(response.body.data, null)
        done()
      })
    })
  })
})
