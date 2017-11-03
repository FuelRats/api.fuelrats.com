'use strict'

const { Request } = require('../../api/classes/Request')
const db = require('./db')

/**
 * get the auth token/cookie for the test user
 */
async function testUserCookie () {
  const token = await Request.login(db.user.test.email, db.user.test.password)
  return { Cookie: token }
}

/**
 * get the auth cookie token for the admin user
 */
async function adminUserCookie () {
  const token = await Request.login(db.user.admin.email, db.user.admin.password)
  return { Cookie: token }
}

/**
 * get the basic token for the admin oauth client
 */
function adminClientBasic () {
  return {
    Authorization: 'Basic ' + Buffer(db.client.admin.name + ':' + db.client.admin.password).toString('base64')
  }
}

module.exports = {
  testUserCookie: testUserCookie,
  adminUserCookie: adminUserCookie,
  adminClientBasic: adminClientBasic
}
