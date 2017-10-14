'use strict'
const { GET, POST, Request } = require('../../api/classes/Request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')

let loginCookie = null
let adminLoginCookie = null

module.exports = {
  setUp: async function (test) {
    await db.init()
    await app.init()
    loginCookie = await Request.login('testuser@fuelrats.com', 'testuser')
    adminLoginCookie = await Request.login('admintestuser@fuelrats.com', 'testuser')
    test()
  },

  testRescuesCreate: asyncWrap(async function (test) {

    test.expect(5)

    let post = await new Request(POST, {
      path: '/rescues',
      insecure: true,
      headers: {
        'Cookie': adminLoginCookie
      }
    }, {
      platform: 'xb',
      system: 'NLTT 48288'
    })

    let res = post.body

    test.strictEqual(post.response.statusCode, 201)
    test.equal(res.error, null)

    if(res.data) {
      let attributes = res.data.attributes
      test.notEqual(res.data.id, null)
      test.notStrictEqual(Date.parse(attributes.createdAt), NaN)
      test.notStrictEqual(Date.parse(attributes.updatedAt), NaN)

    }

  })
}
