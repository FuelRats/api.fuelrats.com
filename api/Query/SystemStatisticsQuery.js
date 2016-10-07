'use strict'
let db = require('./../db').db
let Query = require('./index')

/**
 * A class representing a rescue query
 */
class SystemStatisticsQuery extends Query {
  /**
   * Create a sequelize rescue query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)
    this._query.include = []
    this._query.attributes = [
      'system',
      [this._countSystemsField, 'count']
    ]
    this._query.group = ['system']
  }

  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the direction in which to order
   */
  order (order) {
    let direction = 'ASC'
    if (!order) {
      order = this._countSystemsField
      direction = this.defaultSortDirection
    } else {
      if (order.startsWith('-')) {
        order = order.substring(1)
        direction = 'DESC'
      }
      if (order === 'count') {
        order = this._countSystemsField
      }
    }
    return { field: order, direction: direction }
  }

  get _countSystemsField () {
    return db.fn('COUNT', 'system')
  }
}

module.exports = SystemStatisticsQuery