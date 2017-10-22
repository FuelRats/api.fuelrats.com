'use strict'
const { POST, Request } = require('../../api/classes/Request')
const { HTTP_CREATED } = require('./const')

/**
 * Create a rescue payload
 * @param auth authentication credentials
 * @param rescue rescue details
 * @returns {Promise.<void>}
 */
exports.create = async function create (auth, rat) {

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