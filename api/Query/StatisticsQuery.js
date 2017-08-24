'use strict'
const db = require('./../db').db
const Query = require('./index')
const API = require('../classes/API')

/**
 * A class representing a rescue query
 */
class StatisticsQuery extends Query {
  /**
   * Create a sequelize statistics query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)
    this._query.include = []

    this._query.having = []
    for (let conditional of Object.keys(this._query.where)) {
      let comparator = API.getComparator(this.comparators, conditional)
      if (comparator) {
        this._query.having = db.where(comparator, this._query.where[conditional])
      } else if (this[conditional]) {
        this._query.having = db.where(this[conditional], this._query.where[conditional])
      } else {
        this._query.having.push(db.where(conditional, this._query.where[conditional]))
      }
    }

    this._query.where = {}
  }


  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the direction
   */
  order (order) {
    let direction = 'ASC'
    if (!order) {
      order = this.count
      direction = this.defaultSortDirection
    } else {
      if (order.startsWith('-')) {
        order = order.substring(1)
        direction = 'DESC'
      }
      if (order === 'count') {
        order = this.count
      }

      let comparator = API.getComparator(this.comparators, order)
      if (comparator) {
        order = comparator
      }
    }
    return { field: order, direction: direction }
  }

  limit (limit) {
    return Number(limit) || null
  }
}

module.exports = StatisticsQuery