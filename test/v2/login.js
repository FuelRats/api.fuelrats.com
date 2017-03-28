'use strict'
let { GET, POST, APITest } = require('../../api/classes/APITest')


module.exports = {
  testLogin: function (test) {
    test.expect(11)

    let loginData = {
      email: 'admintestuser@fuelrats.com',
      password: 'testuser'
    }

    new APITest(POST, {
      path: '/login'
    }, loginData).then(function (post) {
      let res = post.body

      test.strictEqual(post.response.statusCode, 200)

      test.equal(res.error, null)
      test.notEqual(res.data.id, null)
      test.strictEqual(res.data.email, 'admintestuser@fuelrats.com')
      test.ok(res.data.groups.includes('rat'), 'User result does not contain rat user group')
      test.ok(res.data.groups.includes('dispatch'), 'User result does not contain dispatch user group')
      test.ok(res.data.groups.includes('admin'), 'User result does not contain admin user group')
      test.notStrictEqual(Date.parse(res.data.createdAt), NaN)
      test.notStrictEqual(Date.parse(res.data.updatedAt), NaN)
      test.ok(res.data.nicknames.includes('admintestnick'), 'User result does not contain test nickname')
      test.equal(res.data.image, null)

      test.done()
    })
  }
}