'use strict'

let Result = require('./index')

/**
 * Class for generating an API rescue result from a database result
 */
class UserResult extends Result {
  constructor (dbResult, params) {
    super(dbResult, params)
  }


  /**
   * Create an API result from a single database result item
   * @param dbResult A single database result item returned by sequelize
   * @param params API request parameters
   * @returns {Object|*|String|string|{type, data}}
   */
  fromSequelize (dbResult) {
    let result = super.fromSequelize(dbResult)
    delete result.password
    return result
  }
}

module.exports = UserResult