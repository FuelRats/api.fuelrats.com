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
  constructor (dbResult, params = {}) {
    this._params = params

    if (!dbResult) {
      return null
    }

    if (dbResult.rows) {
      this._result = dbResult.rows.map(this.fromSequelize.bind(this))
    } else if (Array.isArray(dbResult)) {
      this._result = dbResult.map(this.fromSequelize.bind(this))
    } else {
      this._result = this.result(dbResult)
    }
  }

  result (dbResult) {
    return this.fromSequelize(dbResult)
  }

  /**
   * Create an API result from a single database result item
   * @param dbResult A single database result item returned by sequelize
   * @param params API request parameters
   * @returns {Object|*|String|string|{type, data}}
   */
  fromSequelize (dbResult) {
    let result = dbResult.toJSON()
    if (this._params.fields) {
      let fields = this._params.fields.split(',')
      for (let key of Object.keys(result)) {
        if (!fields.includes(key)) {
          delete result[key]
        }
      }
    }
    return result
  }

  toResponse () {
    return this._result
  }
}

module.exports = Result