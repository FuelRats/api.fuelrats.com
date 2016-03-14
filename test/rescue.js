'use strict'
// Imports
// =============================================================================

let chai = require('chai')
let request = require('supertest')
let assert = chai.assert

let generate = require('./generator')

// Set up globals
// =============================================================================

let rootUrl = 'http://localhost:8080'
request = request(rootUrl)

// Before and After hooks
// =============================================================================




// PULL THE LEVER!
// =============================================================================

describe('Rescue Endpoints', function () {
  describe('POST /rescues', function () {
    // Create a rescue object
    let rescue = generate.randomRescue()

    it('should create a new rescue', function (done) {

      request.post('/rescues').send(rescue).expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data.client.CMDRname, rescue.client.CMDRname)
        assert.equal(response.body.data.client.nickname, rescue.client.nickname)
        assert.equal(response.body.data.codeRed, rescue.codeRed)
        assert.equal(response.body.data.system, rescue.system)
        assert.equal(response.body.data.platform, rescue.platform)

        done()
      })
    })
  })




  describe('GET /rescues', function () {
    it('should return a list of rescues', function (done) {
      request.get('/rescues').expect(200).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isArray(response.body.data)

        done(error)
      })
    })
  })


  describe('GET /rescues/:id', function () {
    // Create a rescue object
    let rescue = generate.randomRescue()

    // Create a new rescue to test against
    before(function (done) {
      request.post('/rescues').send(rescue).end(function (error, response) {
        if (error) {
          return done(error)
        }

        rescue.id = response.body.data._id

        done()
      })
    })

    it('should return a rescue', function (done) {
      request.get('/rescues/' + rescue.id).expect(200).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Make sure our response has the right data
        assert.equal(response.body.data.id, rescue.id)

        done()
      })
    })
  })




  describe('PUT /rescues/:id', function () {
    let rescue

    // Create a new rescue to test against
    before(function (done) {
      request.post('/rescues').send(generate.randomRescue()).end(function (error, response) {
        if (error) {
          return done(error)
        }

        rescue = response.body.data

        done()
      })
    })

    it('should update a rescue', function (done) {
      request.put('/rescues/' + rescue.id).send({
        nickname: 'Edited Test Client ' + (Date.now() - parseInt((Math.random() * Math.random()) * 1000000)).toString(36)
      }).expect(200).end(function (error) {
        if (error) {
          return done(error)
        }

        done()
      })
    })
  })
})
