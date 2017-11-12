'use strict'
const { get, post } = require('./request')
const { HTTP_CREATED } = require('./const')


/**
 * Create a ship
 * @param auth authentication credentials
 * @param ship ship details
 * @returns {Promise.<void>}
 */
async function create (auth, ship) {
  
  const createData = Object.assign({
    shipType: 'Cobra MkIII'
  }, ship)

  const createReq = await post(auth, '/ships', createData)

  if (createReq.response.statusCode !== HTTP_CREATED) {
    throw new Error('Failed to create ship')
  }

  return createReq.body.data

}

/**
 * Find a ship by ratId and name
 * @param auth authentication credentials
 * @param ratId 
 * @param name ship name
 * @returns {Promise.<void>}
 */
async function findByRatIdAndName (auth, ratId, name) {
  const findReq = await get(auth, '/ships?name=' + name + '&ratId=' + ratId)

  return findReq.body ? findReq.body.data : null

}

/**
 * Find or create a ship by name and maybe type
 * @param auth authentication credentials
 * @param ship rat details
 * @returns {Promise.<void>}
 */
async function findOrCreate (auth, ship) {

  let fr = await findByRatIdAndName(auth, ship.ratId, ship.name)
  return fr.length ? fr[0] : create(auth, ship)
}

module.exports = {
  create, findOrCreate
}