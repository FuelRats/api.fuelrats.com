
import { db } from './../db'
import StatisticsQuery from './statistics'
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
  constructor ({params, connection}) {
    super({params, connection})
    this._query.raw = true
    this._query.subQuery = false

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
          attributes: [
            'id',
            'name'
          ],
          include: []
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
      [db.literal('SUM(CASE WHEN "firstLimpetId" IS NOT NULL THEN 1 ELSE 0 END)'), 'rescueCount']
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
        order = this._countField
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
      fields: ['outcome'],
      options: [
        ['success', 'success'],
        ['failure', 'failure'],
        ['invalid', 'invalid'],
        ['other', 'other']
      ]
    }, {
      fields: ['codeRed', 'platform', 'outcome'],
      options: [
        ['codered', true, null],
        ['coderedsuccess', true, null, 'success'],
        ['coderedfailure', true, null, 'failure'],
        ['pccodered', true, 'pc'],
        ['pccoderedsuccess', true, 'pc', 'success'],
        ['pccoderedfailure', true, 'pc', 'failure'],
        ['pscodered', true, 'ps'],
        ['pscoderedsuccess', true, 'ps', 'success'],
        ['pscoderedfailure', true, 'ps', 'failure'],
        ['xbcodered', true, 'xb'],
        ['xbcoderedsuccess', true, 'xb', 'success'],
        ['xbcoderedfailure', true, 'xb', 'failure']
      ]
    }, {
      fields: ['platform', 'outcome'],
      options: [
        ['pc', 'pc'],
        ['pcsuccess', 'pc', 'success'],
        ['pcfailure', 'pc', 'failure'],
        ['ps', 'ps'],
        ['pssuccess', 'ps', 'success'],
        ['psfailure', 'ps', 'failure'],
        ['xb', 'xb'],
        ['xbsuccess', 'xb', 'success'],
        ['xbfailure', 'xb', 'failure']
      ],
    }]
  }

  get _countField () {
    return db.literal('SUM(CASE WHEN "firstLimpetId" IS NOT NULL THEN 1 ELSE 0 END)')
  }
}

module.exports = RatsStatisticsQuery
