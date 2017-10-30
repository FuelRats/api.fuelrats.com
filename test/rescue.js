'use strict'
const { get, post } = require('./support/request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const auth = require('./support/auth')
const rescue = require('./support/rescue')
const { HTTP_CREATED, HTTP_OK } = require('./support/const')

module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },
  /**
   * @api {post} /rescues Create rescue
   * @apiName CreateRescue
   * @apiGroup Rescue
   * 
   * @apiHeader {String} Cookie auth token
   * @apiParam {String} client
   * @apiParam {String} platform
   * @apiParam {String} system
   * @apiSuccess (201) {Object} data Rescue data 
   */
  rescueCreate: asyncWrap(async function (test) {

    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()

    const create = await post(adminUser, '/rescues', {
      platform: 'xb',
      system: 'NLTT 48288'
    })

    let res = create.body

    test.strictEqual(create.response.statusCode, HTTP_CREATED)
    test.equal(res.error, null)

    if (res.data) {
      let { attributes } = res.data
      test.notEqual(res.data.id, null)
      test.notStrictEqual(Date.parse(attributes.createdAt), NaN)
      test.notStrictEqual(Date.parse(attributes.updatedAt), NaN)

    }

  }),
  /**
   * @api {get} /rescues/:id Find rescue
   * @apiName FindRescueById
   * @apiGroup Rescue
   * 
   * @apiHeader {String} Cookie auth token
   * @apiParam {String} id rescue id
   */
  rescueFindById: asyncWrap(async function (test) {

    const NUM_TESTS = 6
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()

    const res = await rescue.create(adminUser, {platform: 'xb', system: 'sol'})
    test.notEqual(res.id, null)

    const find = await get(adminUser, '/rescues/' + res.id)

    test.strictEqual(find.response.statusCode, HTTP_OK)
    if (find.body) {
      let { data } = find.body
      test.strictEqual(data.length, 1) // should have only one rescue returned
      test.strictEqual(data[0].id, res.id)
      const attr = data[0].attributes
      test.strictEqual(attr.system, 'sol')
      test.strictEqual(attr.platform, 'xb')
    }
  })
}
