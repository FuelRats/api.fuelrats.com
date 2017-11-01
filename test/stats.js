'use strict'
const { get } = require('./support/request')
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
   * @apiExample
   * GET /rescues/rescues HTTP/1.1
   * Cookie: fuelrats:session=eyJ1c2VySWQiOiJiYTZmN2ViMy0zYzFjLTQ0MDktOWEwZS1iM2IwYjRjMzdjN2IiLCJfZXhwaXJlIjoxNTA5NDg0MDMwODg1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; path=/; httponly;
   * Content-Type: application/json
   */
  rescues: asyncWrap(async function (test) {

    const NUM_TESTS = 6
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()

    await rescue.create(adminUser, {platform: 'xb', system: 'sol'})
    await rescue.create(adminUser, {platform: 'pc', system: 'maia'})
    await rescue.create(adminUser, {platform: 'pc', system: 'fuelum'})
    await rescue.create(adminUser, {codeRed: true, platform: 'ps', system: 'beagles point'})

    const stats = await get(adminUser, '/statistics/rescues')

    test.strictEqual(stats.response.statusCode, HTTP_OK)
    let res = stats.body
    if (res.data) {
      test.strictEqual(res.data.length, 1) // should have only one rescue stats
      let attr = res.data[0].attributes
      test.strictEqual(attr.codeRed, '1')
      test.strictEqual(attr.pc, '2')
      test.strictEqual(attr.ps, '1')
      test.strictEqual(attr.xb, '1')
    }


  }),
  /**
   * @api {get} /statistics/rats Get rat rescue stats
   * @apiName StatsRats
   * @apiGroup Statistics
   * 
   * @apiHeader {String} Cookie auth token
   * @apiExample
   * GET /rescues/rats HTTP/1.1
   * Cookie: fuelrats:session=eyJ1c2VySWQiOiJiYTZmN2ViMy0zYzFjLTQ0MDktOWEwZS1iM2IwYjRjMzdjN2IiLCJfZXhwaXJlIjoxNTA5NDg0MDMwODg1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; path=/; httponly;
   * Content-Type: application/json
   */
  ratsWithNoUser: asyncWrap(async function (test) {

    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()
    await rescue.create(adminUser, {platform: 'xb', system: 'sol', rats: ['bill', 'bob','sue'], firstLimpet: 'sue'})
    await rescue.create(adminUser, {platform: 'pc', system: 'maia', rats: ['jim', 'kim'], firstLimpet: 'kim'})
    await rescue.create(adminUser, {platform: 'pc', system: 'fuelum', rats: ['kim', 'bin'], firstLimpet: 'kim'})
    await rescue.create(adminUser, {codeRed: true, platform: 'ps', system: 'beagles point', rats: ['huey', 'louis', 'dewey'], firstLimpet: 'louis'})

    const stats = await get(adminUser, '/statistics/rats')

    const NUM_RATS = 9

    test.strictEqual(stats.response.statusCode, HTTP_OK)
    const res = stats.body
    if (res.data) {
      test.strictEqual(res.data.length, NUM_RATS)
    }
  })
}