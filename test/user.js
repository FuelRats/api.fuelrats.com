'use strict'
const { post, get } = require('./support/request')
const db = require('./support/db')
const auth = require('./support/auth')
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
   *  "nickname": "ratty",
   *  "platform": "pc",
   *  "password": "SqueakBaby"
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
  /**
   * @api {get} /users find user
   * @apiName UserFind
   * @apiGroup User
   * 
   * @apiHeader {String} Cookie auth token
   * 
   * @apiExample
   * GET /users?email=roland@fuelrats.com HTTP/1.1
   * Cookie: fuelrats:session=eyJ1c2VySWQiOiJiYTZmN2ViMy0zYzFjLTQ0MDktOWEwZS1iM2IwYjRjMzdjN2IiLCJfZXhwaXJlIjoxNTA5NDg0MDMwODg1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; path=/; httponly;
   * 
   */
  findByEmail: asyncWrap(async function (test) {
    const NUM_TESTS = 4
    test.expect(NUM_TESTS)

    const userData = {
      email: 'roland@fuelrats.com',
      platform: 'pc',
      name: 'roland',
      nickname: 'ratty',
      password: 'SqueakBaby'
    }

    const register = await post(null, '/register', userData)
    test.strictEqual(register.response.statusCode, HTTP_OK)

    // login as the same user
    const adminUser = await auth.adminUser()
    const find = await get(adminUser, '/users?email=' + userData.email)
    test.strictEqual(find.response.statusCode, HTTP_OK)

    if (find.body) {
      let { data } = find.body
      test.strictEqual(data.length, 1) // should have only one user returned
      test.strictEqual(data[0].id, register.body.data[0].id)
    }
  }),
  /**
   * @api {get} /users/:id find user by id
   * @apiName UserFindById
   * @apiGroup User
   * 
   * @apiHeader {String} Cookie auth token
   * 
   * @apiExample
   * GET /users/0bcdcf7a-acae-488d-a1ce-3e66a477003b HTTP/1.1
   * Cookie: fuelrats:session=eyJ1c2VySWQiOiJiYTZmN2ViMy0zYzFjLTQ0MDktOWEwZS1iM2IwYjRjMzdjN2IiLCJfZXhwaXJlIjoxNTA5NDg0MDMwODg1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; path=/; httponly;
   * 
   */
  findById: asyncWrap(async function (test) {
    const NUM_TESTS = 4
    test.expect(NUM_TESTS)

    const userData = {
      email: 'roland@fuelrats.com',
      platform: 'pc',
      name: 'roland',
      nickname: 'ratty',
      password: 'SqueakBaby'
    }

    const register = await post(null, '/register', userData)
    test.strictEqual(register.response.statusCode, HTTP_OK)

    // login as the same user
    const adminUser = await auth.adminUser()
    const find = await get(adminUser, '/users/' + register.body.data[0].id)
    test.strictEqual(find.response.statusCode, HTTP_OK)

    if (find.body) {
      let { data } = find.body
      test.strictEqual(data.length, 1) // should have only one user returned
      test.strictEqual(data[0].attributes.email, userData.email)
    }
  })

}