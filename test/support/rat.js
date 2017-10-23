'use strict'
const { GET, POST, Request } = require('../../api/classes/Request')
const { HTTP_CREATED } = require('./const')

/**
 * Create a rat payload
 * @param auth authentication credentials
 * @param rat rat details
 * @returns {Promise.<void>}
 */
async function create (auth, rat) {

  const payload = Object.assign({
    name: 'kevin',
    platform: 'pc'
  }, rat)

  const post = await new Request(POST, {
    path: '/rats',
    insecure: true,
    headers: { 'Cookie': auth }
  }, payload)

  if ((post.response.statusCode !== HTTP_CREATED) ||
      !post.body || !post.body.data) {
    throw new Error('Failed to create rescue')
  }

  return post.body.data

}

/**
 * Find a rat by name
 * @param auth authentication credentials
 * @param name rat name
 * @returns {Promise.<void>}
 */
async function findByName (auth, name) {
  const get = await new Request(GET, {
    path: '/rats?name=' + name,
    insecure: true,
    headers: { 'Cookie': auth }
  })

  return get.body ? get.body.data : null

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