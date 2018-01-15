
import Query from './index'

/**
 * A class representing a rat query
 */
class RatQuery extends Query {
  /**
   * Create a sequelize rat query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)
  }
}

module.exports = RatQuery