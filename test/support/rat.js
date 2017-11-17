'use strict'
// we are deliberately doing all async functions sequentially to 
// ensure determistic testing
/* eslint-disable no-await-in-loop */
const { get, post } = require('./request')
const { HTTP_CREATED } = require('./const')
const user = require('./user')
const ship = require('./ship')
const { isString } = require('underscore')

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
    createData.userId = (await user.findOrCreate(auth, createData.name + '@fuelrats.com')).id
  }

  const createReq = await post(auth, '/rats', createData)

  if ((createReq.response.statusCode !== HTTP_CREATED) ||
      !createReq.body || !createReq.body.data) {
    throw new Error('Failed to create rescue')
  }

  // check if we need to create ships
  if (createData.ships) {
    for (let ratShip of createData.ships) {
      let shipData = { ratId: createReq.body.data.id }
      if (isString(ratShip)) {
        shipData.name = ratShip
      } else {
        Object.assign(shipData, ratShip)
      }
      await ship.findOrCreate(auth, shipData)
    }
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