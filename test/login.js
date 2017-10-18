'use strict'
const { POST, Request } = require('../api/classes/Request')
const db = require('./support/db')
const { asyncWrap } = require('./support/nodeunit')
const app = require('./support/app')
const { HTTP_OK, HTTP_UNAUTHORIZED} = require('./support/const')

/* eslint-disable no-magic-numbers */

module.exports = {

  setUp: async function (test) {
    await db.init()
    await app.init()
    test()
  },

  adminAuth: asyncWrap(async function (test) {

    test.expect(2)

    let post = await new Request(POST, {
      path: '/login',
      insecure: true
    }, {
      email: db.user.admin.email,
      password: db.user.admin.password
    })
      
    test.strictEqual(post.response.statusCode, HTTP_OK)
    test.equal(post.body, 'OK')

  }),

  testAuth: asyncWrap(async function (test) {

    test.expect(2)

    let post = await new Request(POST, {
      path: '/login',
      insecure: true
    }, {
      email: db.user.test.email,
      password: db.user.test.password
    })

    test.strictEqual(post.response.statusCode, HTTP_OK)
    test.equal(post.body, 'OK')

  }),

  failAuth: asyncWrap(async function (test) {

    test.expect(2) // eslint-disable-line no-magic-numbers

    let post = await new Request(POST, {
      path: '/login',
      insecure: true
    }, {
      email: 'blackrats@fuelrats.com',
      password: 'testuser'
    })

    let res = post.body
  
    test.strictEqual(post.response.statusCode, HTTP_UNAUTHORIZED)

    test.deepEqual(res.errors, [{
      code: HTTP_UNAUTHORIZED,
      detail: 'Authentication failed',
      status: 'Unauthorized',
      title: 'Not Authenticated'
    }])

  })
}