'use strict'
const { get, post } = require('./request')
const { HTTP_CREATED } = require('./const')

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

  const createReq = await post(auth, '/rats', createData)

  if ((createReq.response.statusCode !== HTTP_CREATED) ||
      !createReq.body || !createReq.body.data) {
    throw new Error('Failed to create rescue')
  }

  return createReq.body.data

}

/**
 * Find a rat by name
 * @param auth authentication credentials
 * @param name rat name
 * @returns {Promise.<void>}
 */
async function findByName (auth, name) {
  const findReq = await get(auth, '/rats?name=' + name)

  return findReq.body ? findReq.body.data : null

}

/**
 * Find or create a rat by name
 * @param auth authentication credentials
 * @param rat rat details
 * @returns {Promise.<void>}
 */
async function findOrCreate (auth, rat) {
  let fr = await findByName(auth, rat.name)
  return fr.length ? fr[0] : create(auth, rat)
}

exports.create = create
exports.findByName = findByName
exports.findOrCreate = findOrCreate