'use strict'
const Query = require('./index')

/**
 * A class representing a rat query
 */
class ClientQuery extends Query {
  /**
   * Create a sequelize user query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)

    this._query.attributes = {
      exclude: [
        'deletedAt',
        'secret'
      ]
    }
  }
}

module.exports = ClientQuery