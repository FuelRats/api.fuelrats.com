'use strict'
const { post, login } = require('./request')
const db = require('./db')

/**
 * get the auth token/cookie for the test user
 */
async function testUserCookie () {
  const token = await login(db.user.test.email, db.user.test.password)
  return { Cookie: token }
}

/**
 * get the auth cookie token for the admin user
 */
async function adminUserCookie () {
  const token = await login(db.user.admin.email, db.user.admin.password)
  return { Cookie: token }
}

/**
 * get the OAuth token for the admin user
 */
async function adminUserToken () {

  const token = await post({ 
    Authorization: 'Basic ' + Buffer(db.client.admin.id + ':' + db.client.admin.password).toString('base64')
  }, '/oauth2/token', {
    grant_type: 'password',
    password: db.user.admin.password,
    username: db.user.admin.email
  })

  return { Authorization: 'Bearer '+token.body.access_token }
}

module.exports = {
  testUserCookie: testUserCookie,
  adminUserCookie: adminUserCookie,
  adminUserToken: adminUserToken
}
