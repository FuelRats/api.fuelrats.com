'use strict'
const db = require('./../db').db
const Query = require('./index')

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

    for (let conditional of Object.keys(this._query.where)) {
      let comparator = this.getComparator(this.comparators, conditional)
      if (comparator && comparator[0] !== null) {
        this._query.having = db.where(comparator, this._query.where[conditional])
      } else if (this[conditional]) {
        this._query.having = db.where(this[conditional], this._query.where[conditional])
      } else {
        this._query.having = db.where(conditional, this._query.where[conditional])
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

      let comparator = this.getComparator(this.comparators, order)
      if (comparator) {
        order = comparator
      }
    }
    return {field: order, direction: direction}
  }

  limit (limit) {
    return Number(limit) || null
  }

  get comparators () {
    throw  {name: 'NotImplementedException', description: 'get comparators has not been implemented by subclass'}
  }

  compare (table) {
    return this.comparators.flatMap((comparator) => {
      return comparator.options.map((option) => {
        let [name, ...values] = option

        let cases = []
        for (let [index, value] of values.entries()) {
          if (!value) { continue }

          if (typeof value === 'string') {
            value = `'${value}'`
          }
          cases.push(`"${table}"."${comparator.fields[index]}" = ${value}`)
        }

        return [db.fn('SUM', db.literal(`CASE WHEN ${cases.join(' AND ')} THEN 1 ELSE 0 END`)), name]
      })
    })
  }

  getComparator (field) {
    return this.comparators.flatMap((comparator) => {
      let option = comparator.options.find((option) => {
        let [name] = option
        return name === field ? name : null
      })
      if (option) {
        let [, ...values] = option
        let cases = []

        for (let [index, value] of values.entries) {
          if (!value) { continue }
          if (typeof value === 'string') {
            value = `'${value}'`
          }
          cases.push(`."${comparator.fields[index]}" = ${value}`)
        }
        return db.fn('SUM', db.literal(`CASE WHEN ${cases.join(' AND ')} THEN 1 ELSE 0 END`))
      }
      return null
    })
  }
}


Object.defineProperties(Array.prototype, {
  'flatMap': {
    value: function (lambda) {
      return Array.prototype.concat.apply([], this.map(lambda))
    },
    writeable: false,
    enumerable: false
  }
})

module.exports = StatisticsQuery