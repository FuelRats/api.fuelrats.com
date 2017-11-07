'use strict'
const { get, post } = require('./request')
const { HTTP_CREATED } = require('./const')
const user = require('./user')

/**
 * Create a rat createData
 * @param auth authentication credentials
 * @param rat rat details
 * @returns {Promise.<void>}
 */
async function create (auth, rat) {

  const createData = Object.assign({
    name: 'kevin',
    platform: 'pc'
  }, rat)

  // check if we have a user
  if (!createData.userId) {
    createData.userId = (await user.findOrCreate(auth, rat.name + '@fuelrats.com')).id
  }

  const createReq = await post(auth, '/rats', createData)

  if ((createReq.response.statusCode !== HTTP_CREATED) ||
      !createReq.body || !createReq.body.data) {
    throw new Error('Failed to create rescue')
  }

  return createReq.body.data

}

/**
 * Find a rat by name and platform
 * @param auth authentication credentials
 * @param name rat name
 * @returns {Promise.<void>}
 */
async function findByNameAndPlatform (auth, name, platform) {
  const findReq = await get(auth, '/rats?name=' + name + '&platform=' + platform)

  return findReq.body ? findReq.body.data : null

}

/**
 * Find or create a rat by name and platform
 * @param auth authentication credentials
 * @param rat rat details
 * @returns {Promise.<void>}
 */
async function findOrCreate (auth, rat) {
  let fr = await findByNameAndPlatform(auth, rat.name, rat.platform)
  return fr.length ? fr[0] : create(auth, rat)
}

module.exports = {
  create, findByNameAndPlatform, findOrCreate
}