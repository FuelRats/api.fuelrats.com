'use strict'
const { GET, POST, Request } = require('../../api/classes/Request')

let loginCookie = null
let adminLoginCookie = null

module.exports = {
  setUp: async function (test) {
    loginCookie = await Request.login('testuser@fuelrats.com', 'testuser')
    adminLoginCookie = await Request.login('admintestuser@fuelrats.com', 'testuser')
    test()
  },

  testRescuesCreate: async function (test) {
    let post = await new Request(POST, {
      path: '/rescues',
      insecure: true,
      headers: {
        'Cookie': loginCookie
      }
    }, {
      platform: 'xb',
      system: 'NLTT 48288'
    })

    let res = post.body

    test.strictEqual(post.response.statusCode, 200)

    let attributes = res.data.attributes

    test.equal(res.error, null)
    test.notEqual(res.data.id, null)
    test.strictEqual(attributes.email, 'admintestuser@fuelrats.com')
    test.notStrictEqual(Date.parse(attributes.createdAt), NaN)
    test.notStrictEqual(Date.parse(attributes.updatedAt), NaN)
    test.ok(attributes.nicknames.includes('admintestnick'), 'User result does not contain test nickname')
    test.equal(attributes.image, null)

    test.done()
  },
}
