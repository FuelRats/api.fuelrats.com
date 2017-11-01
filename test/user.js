'use strict'
const { post } = require('./support/request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const { HTTP_BAD_REQUEST } = require('./support/const')

module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },
  /**
   * @api {post} /register Register new user
   * @apiName UserRegister
   * @apiGroup User
   * 
   * @apiExample
   * POST /register HTTP/1.1
   * Content-Type: application/json
   * 
   * {
   *  "email": "roland@fuelrats.com",
   *  "name": "roland",
   *  "nickname": 
   * }
   */
  registerExisting: asyncWrap(async function (test) {
    
    const NUM_TESTS = 1
    test.expect(NUM_TESTS)

    const register = await post(null, '/register', {
      email: db.user.test.email
    })
    test.strictEqual(register.response.statusCode, HTTP_BAD_REQUEST)


  })
}