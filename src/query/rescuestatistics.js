
import { db } from './../db'
import StatisticsQuery from './statistics'

/**
 * A class representing a rescue query
 */
class Rescuestatistics extends StatisticsQuery {
  /**
   * Create a sequelize rescue query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor ({params, connection}) {
    super({params, connection})
    this._query.include = []
    this._query.attributes = [
      [this._groupedByDateField, 'date'],
      [db.fn('COUNT', 'id'), 'total']
    ]
    this._query.attributes = this._query.attributes.concat(this.compare('Rescue', this.comparators))

    this._query.group = [this._groupedByDateField]
  }

  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the direction
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

  limit () {
    return null
  }

  /**
   * Private aggregate field for grouping rescues together by date
   * @returns {*}
   * @private
   */
  get _groupedByDateField () {
    return db.fn('date_trunc', 'day', db.col('createdAt'))
  }

  get comparators () {
    return [{
      fields: ['outcome'],
      options: [
        ['success', 'success'],
        ['failure', 'failure'],
        ['invalid', 'invalid'],
        ['other', 'other']
      ]
    },{
      fields: ['codeRed'],
      options: [
        ['codeRed', true, null]
      ]
    },{
      fields: ['platform'],
      options: [
        ['pc', 'pc'],
        ['ps', 'ps'],
        ['xb', 'xb']
      ]
    }]
  }
}

module.exports = Rescuestatistics
