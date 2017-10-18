'use strict'
const { GET, POST, Request } = require('../api/classes/Request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const auth = require('./support/auth')
const rescue = require('./support/rescue')
const { HTTP_CREATED, HTTP_OK } = require('./support/const')

/* eslint-disable no-magic-numbers */

module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },

  rescueCreate: asyncWrap(async function (test) {

    test.expect(5)

    const adminUser = await auth.adminUser()

    let post = await new Request(POST, {
      path: '/rescues',
      insecure: true,
      headers: {
        'Cookie': adminUser
      }
    }, {
      platform: 'xb',
      system: 'NLTT 48288'
    })

    let res = post.body

    test.strictEqual(post.response.statusCode, HTTP_CREATED)
    test.equal(res.error, null)

    if (res.data) {
      let { attributes } = res.data
      test.notEqual(res.data.id, null)
      test.notStrictEqual(Date.parse(attributes.createdAt), NaN)
      test.notStrictEqual(Date.parse(attributes.updatedAt), NaN)

    }

  }),
  rescueFindById: asyncWrap(async function (test) {
    test.expect(1)

    const adminUser = await auth.adminUser()

    const res = await rescue.create(adminUser, {platform: 'xb', system: 'sol'})

    let get = await new Request(GET, {
      path: '/rescues/' + res.id,
      insecure: true,
      headers: {
        'Cookie': adminUser
      }
    })

    test.strictEqual(get.response.statusCode, HTTP_OK)

  })
}
