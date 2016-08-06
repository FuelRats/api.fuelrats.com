'use strict'
// Imports
// =============================================================================

let chai = require('chai')
let request = require('supertest')
let assert = chai.assert
let generator = require('./generator')

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
let generatedRat

describe('Rat Endpoints', function () {
  describe('POST /rats', function () {
    // Create a rescue object
    let rat = generator.randomRat()

    it('should create a new rat', function (done) {
      this.timeout(5000)
      request.post('/rats')
      .set('Cookie', cookie)
      .send(rat)
      .expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data.CMDRname, rat.CMDRname)
        assert.deepEqual(response.body.data.data, rat.data)
        assert.equal(response.body.data.platform, rat.platform)

        generatedRat = response.body.data
        done()
      })
    })
  })

  describe('GET /rats', function () {

    it('should retrieve a rat matching the one we created', function (done) {
      request.get('/rats?CMDRname=' + generatedRat.CMDRname)
      .set('Cookie', cookie).send()
      .expect(200).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isArray(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data[0].id, generatedRat.id)
        assert.equal(response.body.data[0].CMDRname, generatedRat.CMDRname)
        assert.deepEqual(response.body.data[0].data, generatedRat.data)
        assert.equal(response.body.data[0].platform, generatedRat.platform)
        done()
      })
    })
  })

  describe('PUT /rats', function () {
    // Create a rescue object
    let rat = generator.randomRat()
    console.log('')
    console.log('new CMDR ' + rat.CMDRname)
    console.log('')

    it('should modify the rat', function (done) {
      this.timeout(5000)
      request.put('/rats/' + generatedRat.id)
      .set('Cookie', cookie)
      .send(rat)
      .expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        console.log('')
        console.log('received CMDR ' + response.body.data.CMDRname)
        console.log('')
        assert.equal(response.body.data.CMDRname, rat.CMDRname)
        assert.deepEqual(response.body.data.data, rat.data)
        assert.equal(response.body.data.platform, rat.platform)

        generatedRat = response.body.data
        done()
      })
    })
  })

  describe('DELETE /rats', function () {

    it('should delete the rat', function (done) {
      request.delete('/rats/' + generatedRat.id)
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
