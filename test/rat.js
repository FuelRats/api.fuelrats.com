'use strict'
const { GET, POST, Request } = require('../api/classes/Request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const auth = require('./support/auth')
const rat = require('./support/rat')
const { HTTP_CREATED, HTTP_OK } = require('./support/const')

module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },
  /**
   * @api {post} /rats Create rat
   * @apiName CreateRat
   * @apiGroup Rat
   * 
   * @apiHeader {String} Cookie auth token
   * @apiParam {String} name
   * @apiParam {String} platform
   * @apiPermission user.write
   * @apiSuccess (201) {Object} data Rat data 
   */
  ratCreate: asyncWrap(async function (test) {

    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()
    const data = {
      name: 'roland',
      platform: 'xb'
    }

    let post = await new Request(POST, {
      path: '/rats',
      insecure: true,
      headers: {
        'Cookie': adminUser
      }
    }, data)

    let res = post.body

    test.strictEqual(post.response.statusCode, HTTP_CREATED)
    test.ifError(res.error)

    if (res.data) {
      let { attributes } = res.data
      test.notEqual(res.data.id, null)
      test.strictEqual(attributes.name, data.name)
      test.strictEqual(attributes.platform, data.platform)
    }

  }),
  /**
   * @api {get} /rats/:id Find rat
   * @apiName FindRatById
   * @apiGroup Rat
   * 
   * @apiHeader {String} Cookie auth token
   * @apiParam {String} id rat id
   */
  ratFindById: asyncWrap(async function (test) {
    
    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUser()

    const newRat = {
      name: 'roland',
      platform: 'xb'
    }

    const res = await rat.create(adminUser, newRat)

    let get = await new Request(GET, {
      path: '/rats/' + res.id,
      insecure: true,
      headers: {
        'Cookie': adminUser
      }
    })

    test.strictEqual(get.response.statusCode, HTTP_OK)
    if (get.body) {
      let { data } = get.body
      test.strictEqual(data.length, 1) // should have only one rat returned
      test.strictEqual(data[0].id, res.id)
      const attr = data[0].attributes
      test.strictEqual(attr.name, newRat.name)
      test.strictEqual(attr.platform, newRat.platform)
    }
  })
}