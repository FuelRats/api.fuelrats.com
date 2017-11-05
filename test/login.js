'use strict'
const { post } = require('./support/request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const { HTTP_OK, HTTP_UNAUTHORIZED} = require('./support/const')
const sinon = require('sinon')
const sandbox = sinon.createSandbox()

const BotServ = require('../api/Anope/BotServ')
const nodemailer = require('nodemailer')

const stub = {}

module.exports = {

  setUp: async function (test) {
    await db.init()
    await app.init()
    sandbox.stub(BotServ, 'say')
    stub.sendMail = sandbox.stub()
    sandbox.stub(nodemailer, 'createTransport').returns({
      sendMail: stub.sendMail
    })

    test()
  },
  tearDown: function (test) {
    sandbox.restore()
    test()
  },

  /**
   * @api {post} /login Authenticate as user
   * @apiName Login
   * @apiGroup User
   * @apiParam {String} email
   * @apiParam {String} password
   * @apiSuccess (200) {String} Set-Cookie Authentication token 
   * 
   * @apiExample
   * POST /login HTTP/1.1 
   * Content-Type: application/json
   * 
   * {
   *  "email": "roland@fuelrats.com",
   *  "password": "SqueakBaby"
   * }
   * 
   */
  adminAuth: asyncWrap(async function (test) {

    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    let login = await post(null, '/login', {
      email: db.user.admin.email,
      password: db.user.admin.password
    })
      
    test.strictEqual(login.response.statusCode, HTTP_OK)
    test.equal(login.body, 'OK')

  }),

  testAuth: asyncWrap(async function (test) {

    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    let login = await post(null, '/login', {
      email: db.user.test.email,
      password: db.user.test.password
    })

    test.strictEqual(login.response.statusCode, HTTP_OK)
    test.equal(login.body, 'OK')

  }),

  failAuth: asyncWrap(async function (test) {

    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    let login = await post(null, '/login', {
      email: 'blackrats@fuelrats.com',
      password: 'testuser'
    })

    test.strictEqual(login.response.statusCode, HTTP_UNAUTHORIZED)
    test.deepEqual(login.body.errors, [{
      code: HTTP_UNAUTHORIZED,
      detail: 'Authentication failed',
      status: 'Unauthorized',
      title: 'Not Authenticated'
    }])

  }),
  /**
   * @api {post} /oauth2/token Request OAuth token
   * @apiName OAuthToken
   * @apiGroup User
   * @apiParam {string} grant_type 'password'
   * @apiParam {String} email
   * @apiParam {String} password
   * 
   * @apiExample
   * POST /oauth2/token HTTP/1.1 
   * Content-Type: application/json
   * Authorization: Basic OWM1ZjhkMzItNGU5ZS00MjgxLTk0MzItNzk4ODBjMDBhMGU5OnRlc3R1c2Vy
   * 
   * {
   *  "grant_type": "password",
   *  "email": "roland@fuelrats.com",
   *  "password": "SqueakBaby"
   * }
   * 
   */
  oauthToken: asyncWrap(async function (test) {
    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    const token = await post({ 
      Authorization: 'Basic ' + Buffer(db.client.admin.id + ':' + db.client.admin.password).toString('base64')
    }, '/oauth2/token', {
      grant_type: 'password',
      password: db.user.admin.password,
      username: db.user.admin.email
    })

    test.strictEqual(token.response.statusCode, HTTP_OK)
    test.ok(token.body.access_token)

  }),
  resetPassword: asyncWrap(async function (test) {
    const NUM_TESTS = 4
    test.expect(NUM_TESTS)

    const reset = await post(null, '/reset', {
      email: db.user.test.email
    })

    test.strictEqual(reset.response.statusCode, HTTP_OK)
    test.equal(reset.body, 'OK')
    test.strictEqual(BotServ.say.callCount, 1)
    test.strictEqual(stub.sendMail.callCount, 1)

  })
}