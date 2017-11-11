'use strict'
const { get, post } = require('./request')
const { HTTP_CREATED } = require('./const')

/**
 * Create a user
 * @param auth authentication credentials
 * @param user user details
 * @returns {Promise.<void>}
 */
async function create (auth, user) {
  
  const createData = Object.assign({
    email: 'kevin@fuelrats.com',
    // this is the result of bcrypt.hash('testuser', 12)
    password: '$2a$12$QM4/plOu7n9BThFGbG8USO1jWnwJq6Lk7GnPtzhb./o2jHhbXayTy'
  }, user)

  const createReq = await post(auth, '/users', createData)

  if ((createReq.response.statusCode !== HTTP_CREATED) ||
      !createReq.body || !createReq.body.data) {
    throw new Error('Failed to create user')
  }

  return createReq.body.data

}

/**
 * Find a user by email
 * @param auth authentication credentials
 * @param email user email
 * @returns {Promise.<void>}
 */
async function findByEmail (auth, email) {
  const findReq = await get(auth, '/users?email=' + email)

  return findReq.body ? findReq.body.data : null

}

/**
 * Find or create a user by email
 * @param auth authentication credentials
 * @param email
 * @returns {Promise.<void>}
 */
async function findOrCreate (auth, email) {
  let find = await findByEmail(auth, email)
  return find.length ? find[0] : create(auth, { email })
}

module.exports = {
  create, findByEmail, findOrCreate
}
