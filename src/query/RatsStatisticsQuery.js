
import { db } from './../db'
import StatisticsQuery from './StatisticsQuery'
import { Rescue, User, Rat } from '../db'

/**
 * A class representing a rescue query
 */
class RatsStatisticsQuery extends StatisticsQuery {
  /**
   * Create a sequelize rescue query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)
    this._query.raw = true

    this._query.include = [
      {
        model: Rescue,
        as: 'firstLimpet',
        attributes: [],
        include: [],
        required:  false,
        duplicating: false
      },
      {
        model: User,
        as: 'user',
        attributes: [
          'id',
        ],
        include: [{
          model: Rat,
          as: 'displayRat',
          duplicating: false,
          attributes: [
            'id',
            'name'
          ]
        }],
        required: false,
        duplicating: false,
        scopes: [
          null,
          'stats'
        ]
      }
    ]
    this._query.attributes = [
      [db.literal('CASE WHEN "Rat"."userId" IS NULL THEN "Rat"."id" ELSE "Rat"."userId" END'), 'id'],
      [db.literal('array_agg(DISTINCT "Rat"."name")'), 'rats'],
      [db.literal('SUM(CASE WHEN "firstLimpetId" IS NOT NULL THEN 1 ELSE 0 END)'), 'rescueCount'],
      [db.fn('COUNT', db.fn('nullif', db.col('codeRed'), false)), 'codeRed']
    ]

    this._query.attributes = this._query.attributes.concat(this.compare('firstLimpet', this.comparators))

    this._query.group = [
      db.literal('CASE WHEN "Rat"."userId" IS NULL THEN "Rat"."id" ELSE "Rat"."userId" END'), 
      'user.id', 'user->displayRat.id', 'user->displayRat->ships.id'
    ]
  }

  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the direction
   */
  order (order) {
    let direction = 'ASC'
    if (!order) {
      order = this._countField
      direction = this.defaultSortDirection
    } else {
      if (order.startsWith('-')) {
        order = order.substring(1)
        direction = 'DESC'
      }
      if (order === 'count') {
        order = this._countSystemsField
      }

      let comparator = this.getComparator(this.comparators, order)
      if (comparator) {
        order = comparator
      }
    }
    return { field: order, direction: direction }
  }

  get comparators () {
    return [{
      fields: ['platform'],
      options: [
        ['pc', 'pc'],
        ['ps', 'ps'],
        ['xb', 'xb']
      ]
    }]
  }

  get _countField () {
    return db.literal('SUM(CASE WHEN "firstLimpetId" IS NOT NULL THEN 1 ELSE 0 END)')
  }
}

module.exports = RatsStatisticsQuery