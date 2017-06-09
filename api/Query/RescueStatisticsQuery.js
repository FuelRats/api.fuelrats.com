'use strict'
let db = require('./../db').db
let Query = require('./index')

/**
 * A class representing a rescue query
 */
class RescueStatisticsQuery extends Query {
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
      [this._groupedByDateField, 'date'],
      [db.fn('SUM', db.literal('CASE WHEN "Rescue"."type" = \'success\' THEN 1 ELSE 0 END')), 'successCount'],
      [db.fn('COUNT', 'id'), 'total']
    ]
    this._query.group = [this._groupedByDateField]
  }

  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the direction in which to order
   */
  order (order) {
    let direction = 'ASC'
    if (!order) {
      order = this._groupedByDateField
      direction = this.defaultSortDirection
    } else {
      if (order.startsWith('-')) {
        order = order.substring(1)
        direction = 'DESC'
      }
      if (order === 'date') {
        order = this._groupedByDateField
      }
    }
    return { field: order, direction: direction }
  }

  /**
   * Private aggregate field for grouping rescues together by date
   * @returns {*}
   * @private
   */
  get _groupedByDateField () {
    return db.fn('date_trunc', 'day', db.col('createdAt'))
  }
}

module.exports = RescueStatisticsQuery