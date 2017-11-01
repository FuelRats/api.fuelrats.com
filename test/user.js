'use strict'
const { post } = require('./support/request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const { HTTP_BAD_REQUEST, HTTP_OK } = require('./support/const')


/**
 * Create simple function stub for testing
 */
function stub () {

  const func = function () {
    func.called += 1
  }
  func.called = 0
  return func
}

// stub all the external calls
const NickServ = require('../api/Anope/NickServ')
const HostServ = require('../api/Anope/NickServ')
const BotServ = require('../api/Anope/BotServ')

const orig = {
  register: NickServ.register,
  update: HostServ.update,
  say: BotServ.say
}

const stubs = {
  register: stub(),
  update: stub(),
  say: stub()
}


module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()

    stubs.register.called = 0
    stubs.update.called = 0
    stubs.say.called = 0

    NickServ.register = stubs.register
    HostServ.update = stubs.update
    BotServ.say = stubs.say

    test()
  },
  tearDown: function (test) {
    NickServ.register = orig.register
    HostServ.update = orig.update
    BotServ.say = orig.say
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
  registerNew: asyncWrap(async function (test) {
    const NUM_TESTS = 4
    test.expect(NUM_TESTS)

    const register = await post(null, '/register', {
      email: 'roland@fuelrats.com',
      platform: 'pc',
      name: 'roland',
      nickname: 'ratty',
      password: 'SqueakBaby'
    })
    test.strictEqual(register.response.statusCode, HTTP_OK)
    test.strictEqual(stubs.register.called, 1)
    test.strictEqual(stubs.update.called, 1)
    test.strictEqual(stubs.say.called, 1)

  }),
  registerExisting: asyncWrap(async function (test) {
    
    const NUM_TESTS = 4
    test.expect(NUM_TESTS)

    const register = await post(null, '/register', {
      email: db.user.test.email
    })
    test.strictEqual(register.response.statusCode, HTTP_BAD_REQUEST)
    test.strictEqual(stubs.register.called, 0)
    test.strictEqual(stubs.update.called, 0)
    test.strictEqual(stubs.say.called, 0)

  }),
  invalidPlatform: asyncWrap(async function (test) {
    const NUM_TESTS = 4
    test.expect(NUM_TESTS)

    const register = await post(null, '/register', {
      email: 'roland@fuelrats.com',
      platform: 'PC'
    })
    test.strictEqual(register.response.statusCode, HTTP_BAD_REQUEST)
    test.strictEqual(stubs.register.called, 0)
    test.strictEqual(stubs.update.called, 0)
    test.strictEqual(stubs.say.called, 0)

  }),

}