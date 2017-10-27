'use strict'
const { GET, Request } = require('../api/classes/Request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const { HTTP_OK } = require('./support/const')
const rescue = require('./support/rescue')
const auth = require('./support/auth')

module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },
  /**
   * @api {get} /statistics/rescues Get rescue stats
   * @apiName StatsRescue
   * @apiGroup Statistics
   * 
   * @apiHeader {String} Cookie auth token
   */
  rescues: asyncWrap(async function (test) {

    const NUM_TESTS = 6
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()

    await rescue.create(adminUser, {platform: 'xb', system: 'sol'})
    await rescue.create(adminUser, {platform: 'pc', system: 'maia'})
    await rescue.create(adminUser, {platform: 'pc', system: 'fuelum'})
    await rescue.create(adminUser, {codeRed: true, platform: 'ps', system: 'beagles point'})

    let get = await new Request(GET, {
      path: '/statistics/rescues',
      insecure: true,
      headers: {
        'Cookie': adminUser
      }
    })

    test.strictEqual(get.response.statusCode, HTTP_OK)
    let res = get.body
    if (res.data) {
      test.strictEqual(res.data.length, 1) // should have only one rescue stats
      let attr = res.data[0].attributes
      test.strictEqual(attr.codeRed, '1')
      test.strictEqual(attr.pc, '2')
      test.strictEqual(attr.ps, '1')
      test.strictEqual(attr.xb, '1')
    }


  }),
  rats: asyncWrap(async function (test) {

    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()
    await rescue.create(adminUser, {platform: 'xb', system: 'sol', rats: ['bill', 'bob','sue'], firstLimpet: 'sue'})
    await rescue.create(adminUser, {platform: 'pc', system: 'maia', rats: ['jim', 'kim'], firstLimpet: 'kim'})
    await rescue.create(adminUser, {platform: 'pc', system: 'fuelum', rats: ['kim', 'bin'], firstLimpet: 'kim'})
    await rescue.create(adminUser, {codeRed: true, platform: 'ps', system: 'beagles point', rats: ['huey', 'louis', 'dewey'], firstLimpet: 'louis'})

    let get = await new Request(GET, {
      path: '/statistics/rats',
      insecure: true,
      headers: {
        'Cookie': adminUser
      }
    })

    const NUM_RATS = 9

    test.strictEqual(get.response.statusCode, HTTP_OK)
    const res = get.body
    if (res.data) {
      test.strictEqual(res.data.length, NUM_RATS)
    }
  })
}