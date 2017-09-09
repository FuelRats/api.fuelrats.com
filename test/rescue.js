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
console.log('startign tests')

// Before and After hooks
// =============================================================================

describe('Login Test', function () {
  it('should create user session for valid user', function (done) {
    console.log('login test')
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

let generatedRat

describe('POST /rats', function () {
  // Create a rescue object
  let rat = generator.randomRat()

  it('should create a new rat', function (done) {
    console.log('make rat')
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
      console.log(response.body.data)
      done()
    })
  })
})

// PULL THE LEVER!
// =============================================================================
let generatedRescue

describe('Rescue Endpoints', function () {
  describe('POST /rescues', function () {
    // Create a rescue object
    let rescue = generator.randomRescue()
    rescue.firstLimpet = generatedRat.id
    rescue.rats = [generatedRat.id]

    it('should create a new rescue', function (done) {
      this.timeout(5000)
      request.post('/rescues')
      .set('Cookie', cookie)
      .send(rescue)
      .expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data.active, rescue.active)
        assert.equal(response.body.data.client, rescue.client)
        assert.equal(response.body.data.codeRed, rescue.codeRed)
        assert.equal(response.body.data.data, rescue.data)
        assert.equal(response.body.data.epic, rescue.epic)
        assert.equal(response.body.data.firstLimpet, rescue.firstLimpet)
        assert.equal(response.body.data.open, rescue.open)
        assert.equal(response.body.data.notes, rescue.notes)
        assert.equal(response.body.data.platform, rescue.platform)
        assert.equal(response.body.data.quotes, rescue.quotes)
        assert.includes(response.body.data.rats, rescue.firstLimpet)
        assert.equal(response.body.data.successful, rescue.successful)
        assert.equal(response.body.data.system, rescue.system)
        assert.equal(response.body.data.title, rescue.title)
        assert.equal(response.body.data.unidentifiedRats, rescue.unidentifiedRats)

        generatedRescue = response.body.data
        done()
      })
    })
  })

  describe('GET /rescues', function () {

    it('should retrieve a rescue matching the one we created', function (done) {
      request.get('/rescues?id=' + generatedRescue.id)
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
        assert.equal(response.body.data.active, generatedRescue.active)
        assert.equal(response.body.data.client, generatedRescue.client)
        assert.equal(response.body.data.codeRed, generatedRescue.codeRed)
        assert.equal(response.body.data.data, generatedRescue.data)
        assert.equal(response.body.data.epic, generatedRescue.epic)
        assert.equal(response.body.data.firstLimpet, generatedRescue.firstLimpet)
        assert.equal(response.body.data.open, generatedRescue.open)
        assert.equal(response.body.data.notes, generatedRescue.notes)
        assert.equal(response.body.data.platform, generatedRescue.platform)
        assert.equal(response.body.data.quotes, generatedRescue.quotes)
        assert.includes(response.body.data.rats, generatedRescue.firstLimpet)
        assert.equal(response.body.data.successful, generatedRescue.successful)
        assert.equal(response.body.data.system, generatedRescue.system)
        assert.equal(response.body.data.title, generatedRescue.title)
        assert.equal(response.body.data.unidentifiedRats, generatedRescue.unidentifiedRats)
        done()
      })
    })
  })

  describe('GET /rescues', function () {

    it('should retrieve a rescue matching a JSON data value', function (done) {
      request.get('/rescues?data={"foo": ["test"]}')
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
        assert.equal(response.body.data.active, generatedRescue.active)
        assert.equal(response.body.data.client, generatedRescue.client)
        assert.equal(response.body.data.codeRed, generatedRescue.codeRed)
        assert.equal(response.body.data.data, generatedRescue.data)
        assert.equal(response.body.data.epic, generatedRescue.epic)
        assert.equal(response.body.data.firstLimpet, generatedRescue.firstLimpet)
        assert.equal(response.body.data.open, generatedRescue.open)
        assert.equal(response.body.data.notes, generatedRescue.notes)
        assert.equal(response.body.data.platform, generatedRescue.platform)
        assert.equal(response.body.data.quotes, generatedRescue.quotes)
        assert.includes(response.body.data.rats, generatedRescue.firstLimpet)
        assert.equal(response.body.data.successful, generatedRescue.successful)
        assert.equal(response.body.data.system, generatedRescue.system)
        assert.equal(response.body.data.title, generatedRescue.title)
        assert.equal(response.body.data.unidentifiedRats, generatedRescue.unidentifiedRats)
        done()
      })
    })
  })

  describe('PUT /rescues', function () {
    // Create a rescue object
    let rescue = generator.randomRescue()
    rescue.rats = []

    it('should modify the rescue', function (done) {
      this.timeout(5000)
      request.put('/rescues/' + generatedRescue.id)
      .set('Cookie', cookie)
      .send(rescue)
      .expect(201).end(function (error, response) {
        if (error) {
          return done(error)
        }

        // Make sure there are no errors
        assert.notProperty(response.body, 'errors')

        // Make sure our response is correctly constructed
        assert.isObject(response.body.data)

        // Check all of the properties on the returned object
        assert.equal(response.body.data.active, rescue.active)
        assert.equal(response.body.data.client, rescue.client)
        assert.equal(response.body.data.codeRed, rescue.codeRed)
        assert.equal(response.body.data.data, rescue.data)
        assert.equal(response.body.data.epic, rescue.epic)
        assert.equal(response.body.data.firstLimpet, rescue.firstLimpet)
        assert.equal(response.body.data.open, rescue.open)
        assert.equal(response.body.data.notes, rescue.notes)
        assert.equal(response.body.data.platform, rescue.platform)
        assert.equal(response.body.data.quotes, rescue.quotes)
        assert.includes(response.body.data.rats, rescue.firstLimpet)
        assert.equal(response.body.data.successful, rescue.successful)
        assert.equal(response.body.data.system, rescue.system)
        assert.equal(response.body.data.title, rescue.title)
        assert.equal(response.body.data.unidentifiedRats, rescue.unidentifiedRats)

        generatedRescue = response.body.data
        done()
      })
    })
  })

  describe('DELETE /rescues', function () {

    it('should delete the rescue', function (done) {
      request.delete('/rescues/' + generatedRescue.id)
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
