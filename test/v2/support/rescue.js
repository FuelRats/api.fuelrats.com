'use strict'
const { POST, Request } = require('../../../api/classes/Request')

const HTTP_CREATED = 201

/**
 * Create a rescue payload
 * @param auth authentication credentials
 * @param r request
 * @returns {Promise.<void>}
 */
async function create (auth, r) {

  const payload = Object.assign({
    client: 'scarlet_pimpernel',
    platform: 'pc',
    system: 'LHS 3447'
  }, r)

  const post = await new Request(POST, {
    path: '/rescues',
    insecure: true,
    headers: { 'Cookie': auth }
  }, payload)

  if ((post.response.statusCode !== HTTP_CREATED) ||
      !post.body || !post.body.data) {
    throw new Error('Failed to create rescue')
  }

  return post.body.data

}

module.exports.create = create