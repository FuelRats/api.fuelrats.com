'use strict'
// Imports
// =============================================================================

let chai = require('chai')
let assert = chai.assert
let request = require('supertest')

let generate = require('./generator')




// Set up globals
// =============================================================================

let rootUrl = 'http://localhost:8080'
request = request(rootUrl)


// Before and After hooks
// =============================================================================


// PULL THE LEVER!
// =============================================================================

describe('Rat Endpoints', function () {
  describe('POST /rats', function () {
    this.timeout(5000)

    // Create a rat object
    let rat = generate.randomRat()

    it('should create a new rat', function (done) {

      request.post('/rats').send(rat).expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure the POST succeeded
        assert.equal(response.status, 201)

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data.CMDRname, rat.CMDRname)
        assert.deepEqual(response.body.data.nicknames, rat.nicknames)

        done()
      })
    })
  })

  describe('GET /rats', function () {
    this.timeout(5000)
    it('should return a list of rats', function (done) {
      request.get('/rats').end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure the GET succeeded
        assert.equal(response.status, 200)

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isArray(response.body.data)

        done(error)
      })
    })
  })

  describe('GET /api/rats/:id', function () {
    this.timeout(5000)
    // Create a rat object
    let rat = generate.randomRat()

    // Create a new rat to test against
    before(function (done) {
      request.post('/rats').send(rat).expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        rat.id = response.body.data.id

        done()
      })
    })

    it('should return a rat', function (done) {
      request.get('/rats/' + rat.id).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure the request succeeded
        assert.equal(response.status, 200)

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Make sure our response has the right data
        assert.equal(response.body.data.id, rat.id)

        done()
      })
    })
  })




  describe('PUT /rats/:id', function () {
    this.timeout(5000)
    var rat

    // Create a new rat to test against
    before(function (done) {
      request.post('/rats').send(generate.randomRat()).expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        rat = response.body.data

        done()
      })
    })

    it('should update a rat', function (done) {
      request.put('/rats/' + rat.id).send({
        nickname: 'Edited Test Client ' + (Date.now() - parseInt((Math.random() * Math.random()) * 1000000)).toString(36)
      }).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure the POST succeeded
        assert.equal(response.status, 200)

        done()
      })
    })
  })
})
