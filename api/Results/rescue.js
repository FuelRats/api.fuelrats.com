'use strict'

let Result = require('./index')

/**
 * Class for generating an API rescue result from a database result
 */
class RescueResult extends Result {
  /**
   *
   * @param dbResult
   * @param params
   * @returns {Object|*|String|string|{type, data}}
   */
  fromSequelize (dbResult) {
    return dbResult.toJSON()
  }
}

module.exports = RescueResult