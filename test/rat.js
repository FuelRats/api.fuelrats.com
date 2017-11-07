'use strict'
const { get, post } = require('./support/request')
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
   * 
   * @apiExample
   * POST /rats HTTP/1.1 
   * Cookie: fuelrats:session=eyJ1c2VySWQiOiJiYTZmN2ViMy0zYzFjLTQ0MDktOWEwZS1iM2IwYjRjMzdjN2IiLCJfZXhwaXJlIjoxNTA5NDg0MDMwODg1LCJfbWF4QWdlIjo4NjQwMDAwMH0=; path=/; httponly;
   * Content-Type: application/json
   * 
   * {
   *  "name": "roland",
   *  "platform": "xb"
   * }
   */
  ratCreate: asyncWrap(async function (test) {

    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUserCookie()

    const data = {
      name: 'roland',
      platform: 'xb'
    }

    let create = await new post(adminUser, '/rats', data)

    let res = create.body

    test.strictEqual(create.response.statusCode, HTTP_CREATED)
    test.ifError(res.error)

    if (res.data) {
      let { attributes } = res.data
      test.notEqual(res.data.id, null)
      test.strictEqual(attributes.name, data.name)
      test.strictEqual(attributes.platform, data.platform)
    }

  }),
  /**
   * @api {get} /rats/:id Find rat by id
   * @apiName FindRatById
   * @apiGroup Rat
   * 
   * @apiHeader {String} Cookie auth token
   * @apiParam {String} id rat id
   *    
   * @apiExample
   * GET /rats/afd9d83c-3b4b-4ad5-844b-4719850becff HTTP/1.1 
   */
  ratFindById: asyncWrap(async function (test) {
    
    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUserCookie()

    const newRat = {
      name: 'roland',
      platform: 'xb'
    }

    const res = await rat.create(adminUser, newRat)

    const find = await get(null, '/rats/' + res.id)

    test.strictEqual(find.response.statusCode, HTTP_OK)
    if (find.body) {
      let { data } = find.body
      test.strictEqual(data.length, 1) // should have only one rat returned
      test.strictEqual(data[0].id, res.id)
      const attr = data[0].attributes
      test.strictEqual(attr.name, newRat.name)
      test.strictEqual(attr.platform, newRat.platform)
    }
  }),
  /**
   * @api {get} /rats Find rat by name
   * @apiName FindRatByName
   * @apiGroup Rat
   * 
   * @apiHeader {String} Cookie auth token
   * 
   * @apiExample
   * GET /rats?name=roland HTTP/1.1 
   * 
   */
  ratFindByName: asyncWrap(async function (test) {
    
    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUserCookie()

    const newRat = {
      name: 'roland',
      platform: 'xb'
    }

    const res = await rat.create(adminUser, newRat)

    const find = await get(null, '/rats?name=' + newRat.name)

    test.strictEqual(find.response.statusCode, HTTP_OK)
    if (find.body) {
      let { data } = find.body
      test.strictEqual(data.length, 1) // should have only one rat returned
      test.strictEqual(data[0].id, res.id)
      const attr = data[0].attributes
      test.strictEqual(attr.name, newRat.name)
      test.strictEqual(attr.platform, newRat.platform)
    }
  }),
  /**
   * @api {get} /rats Find rat by name and platform
   * @apiName FindRatByNameAndPlatform
   * @apiGroup Rat
   * @apiExample
   * GET /rats?name=roland&platform=xb HTTP/1.1 
   * 
   */
  ratFindByNameAndPlatform: asyncWrap(async function (test) {
    
    const NUM_TESTS = 5
    test.expect(NUM_TESTS)

    const adminUser = await auth.adminUserCookie()

    const newRat = {
      name: 'roland',
      platform: 'xb'
    }

    await rat.create(adminUser, newRat)

    // same rat name, different platform
    newRat.platform = 'pc'
    const res = await rat.create(adminUser, newRat)
    

    const find = await get(null, '/rats?name=' + newRat.name + '&platform=' + newRat.platform)

    test.strictEqual(find.response.statusCode, HTTP_OK)
    if (find.body) {
      let { data } = find.body
      test.strictEqual(data.length, 1) // should have only one rat returned
      test.strictEqual(data[0].id, res.id)
      const attr = data[0].attributes
      test.strictEqual(attr.name, newRat.name)
      test.strictEqual(attr.platform, newRat.platform)
    }
  })
}