'use strict'

const Result = require('./index')
const JSONAPISerializer = require('jsonapi-serializer').Serializer

/**
 * Class for generating an API rescue result from a database result
 */
class RescueResult extends Result {
  constructor (dbResult, params) {
    super(dbResult, params)
  }
}

module.exports = RescueResult