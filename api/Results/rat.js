'use strict'

let Result = require('./index')

/**
 * Class for generating an API rescue result from a database result
 */
class RatResult extends Result {
  constructor (dbResult, params) {
    super(dbResult, params)
  }
}

module.exports = RatResult