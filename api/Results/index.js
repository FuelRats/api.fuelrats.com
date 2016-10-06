'use strict'

/**
 * Class for generating an API result from a database result
 */
class Result {

  /**
   * Create an API result instance from a database result
   * @param {Object} dbResult - A database result returned by sequelize
   * @param {Object} params - API request parameters
   */
  constructor (dbResult, params) {
    this._params = params

    if (!dbResult) {
      return null
    }

    if (dbResult.rows) {
      return dbResult.rows.map(this.fromSequelize)
    } else if (Array.isArray(dbResult)) {
      return dbResult.map(this.fromSequelize)
    } else {
      return this.fromSequelize(dbResult)
    }
  }

  /**
   * Create an API result from a single database result item
   * @param dbResult A single database result item returned by sequelize
   * @param params API request parameters
   * @returns {Object|*|String|string|{type, data}}
   */
  fromSequelize (dbResult) {
    return dbResult.toJSON()
  }
}

module.exports = Result