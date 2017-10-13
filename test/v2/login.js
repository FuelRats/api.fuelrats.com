'use strict'
const { GET, POST, Request } = require('../../api/classes/Request')
const db = require('./support/db')

module.exports = {

  setUp: async function (test) {
    await db.init()
    test()
  },

  adminAuth: async function (test) {

    test.expect(2)

    try {
      let post = await new Request(POST, {
        path: '/login',
        insecure: true
      }, {
        email: db.user.admin.email,
        password: db.user.admin.password
      })
      
      test.strictEqual(post.response.statusCode, 200)
      test.equal(post.body, 'OK')

    } catch (err) {
      test.ifError(err)
    }

    test.done()
  },

  testAuth: async function (test) {

    test.expect(2)

    try {
      let post = await new Request(POST, {
        path: '/login',
        insecure: true
      }, {
        email: db.user.test.email,
        password: db.user.test.password
      })
  
      test.strictEqual(post.response.statusCode, 200)
      test.equal(post.body, 'OK')

    } catch (err) {
      test.ifError(err)
    }

    test.done()
  },

  testAuthFail: async function (test) {

    test.expect(2)

    try {
      let post = await new Request(POST, {
        path: '/login',
        insecure: true
      }, {
        email: 'blackrats@fuelrats.com',
        password: 'testuser'
      })
  
      let res = post.body
    
      test.strictEqual(post.response.statusCode, 401)
  
      test.deepEqual(res.errors, [{
        code: 401,
        detail: 'Authentication failed',
        status: 'Unauthorized',
        title: 'Not Authenticated'
      }])
    } catch (err) {
      test.ifError(err)
    }

    test.done()
  }
}