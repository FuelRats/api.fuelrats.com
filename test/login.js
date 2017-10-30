'use strict'
const { post } = require('./support/request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const { HTTP_OK, HTTP_UNAUTHORIZED} = require('./support/const')

module.exports = {

  setUp: async function (test) {
    await db.init()
    await app.init()
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

  })
}