'use strict'
const { GET, POST, PUT, Request } = require('../../api/classes/Request')

/**
 * Test helper function to perform a local HTTP GET
 * @param {*} auth authentication token
 * @param {*} path 
 */
function get (auth, path) {
  return new Request(GET, {
    path: path,
    insecure: true,
    headers: auth ? { 'Cookie': auth } : null
  })
}

/**
 * Test helper function to perform a local HTTP POST
 * @param {*} auth authentication token
 * @param {*} path 
 * @param {*} payload 
 */
function post (auth, path, payload) {
  return new Request(POST, {
    path: path,
    insecure: true,
    headers: auth ? { 'Cookie': auth } : null
  }, payload)
}

/**
 * Test helper function to perform a local HTTP PUT
 * @param {*} auth authentication token
 * @param {*} path 
 * @param {*} payload 
 */
function put (auth, path, payload) {
  return new Request(PUT, {
    path: path,
    insecure: true,
    headers: auth ? { 'Cookie': auth } : null
  }, payload)
}

module.exports = {
  get: get,
  post: post,
  put: put
}

