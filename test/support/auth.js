'use strict'

const { Request } = require('../../api/classes/Request')
const db = require('./db')

/**
 * get the auth token/cookie for the test user
 */
exports.testUser = function () {
  return Request.login(db.user.test.email, db.user.test.password)
}


exports.adminUser = function () {
  return Request.login(db.user.admin.email, db.user.admin.password)
}
