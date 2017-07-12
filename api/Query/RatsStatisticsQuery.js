'use strict'
const db = require('./../db').db
const Query = require('./index')
const API = require('../classes/API')
const Rescue = require('../db').Rescue

/**
 * A class representing a rescue query
 */
class RatsStatisticsQuery extends Query {
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
        required: true
      }
    ]
    this._query.attributes = [
      [db.literal('CASE WHEN "Rat"."userId" IS NULL THEN "Rat"."id" ELSE "Rat"."userId" END'), 'id'],
      [db.literal('array_agg(DISTINCT "Rat"."name")'), 'rats'],
      [db.fn('COUNT', 'Rescue.id'), 'rescueCount'],
      [db.fn('COUNT', db.fn('nullif', db.col('codeRed'), false)), 'codeRed'],
      [db.fn('COUNT', db.literal('CASE WHEN "firstLimpet"."platform" = \'pc\' THEN 1 END')), 'pc']
    ]

    this._query.attributes = this._query.attributes.concat(API.compare('firstLimpet', this.comparators))

    this._query.group = [db.literal('CASE WHEN "Rat"."userId" IS NULL THEN "Rat"."id" ELSE "Rat"."userId" END')]
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

  get comparators () {
    return [{
      field: 'platform',
      options: [
        ['pc'],
        ['ps'],
        ['xb']
      ]
    }]
  }

  get _countField () {
    return db.fn('COUNT', 'Rescue.id')
  }
}

module.exports = RatsStatisticsQuery