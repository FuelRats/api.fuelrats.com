'use strict'
const { post } = require('./support/request')
const db = require('./support/db')
const auth = require('./support/auth')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const rat = require('./support/rat')
const { HTTP_CREATED } = require('./support/const')


module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },
  tearDown: function (test) {
    test()
  },
  /**
   * @api {post} /ships Create new ship
   * @apiName ShipCreate
   * @apiGroup Ship
   * 
   * @apiHeader {String} Cookie auth token
   * 
   * @apiExample
   * POST /ships HTTP/1.1
   * Cookie: fuelrats:session=eyJ1c2VySWQiOiJiYTZmN2ViMy0zYzFjLTQ0MDktOWEwZS1iM2IwYjRjMzdjN2IiLCJfZXhwaXJlIjoxNTA5NDg0MDMwODg1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; path=/; httponly;
   * Content-Type: application/json
   * 
   * {
   *  "type": "Dolphin",
   *  "name": "Flipper",
   *  "ratId": "afd9d83c-3b4b-4ad5-844b-4719850becff"
   * }
   */
  createShip: asyncWrap(async function (test) {
    const NUM_TESTS = 2
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUserCookie()

    const ratId = (await rat.create(adminUser)).id

    const create = await post(adminUser, '/ships', {
      shipType: 'Dolphin',
      name: 'Flipper',
      ratId
    })
    test.strictEqual(create.response.statusCode, HTTP_CREATED)
    test.equal(create.body.error, null)

  })

}