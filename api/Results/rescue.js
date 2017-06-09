'use strict'

let Result = require('./index')

/**
 * Class for generating an API rescue result from a database result
 */
class RescueResult extends Result {
  constructor (dbResult, params) {
    super(dbResult, params)
  }
}

module.exports = RescueResult