'use strict'
let Rat = require('./index').Rat
let Epic = require('./index').Epic

const defaultRequestLimit = 25
const maximumUnauthenticatedLimit = 100
const maximumAuthenticatedLimit = 1000
const maximumAdminLimit = 5000


/**
 * Class representing a Sequelize database query constructed from an API request
 */
class Query {
  /**
   * Create a Sequelize query from a set of
   * @constructor
   * @param {Object} params - API request parameters
   * @param {Object} connection - A websocket or Express connection object
   */
  constructor (params, connection) {
    this._params = params
    this._connection = connection
  }

  /**
   * Generate a Rescue query
   */
  get Rescue () {
    let params = this._params
    delete params.fields

    let limit = Query.limit(params.limit, this._connection.user)
    delete params.limit

    let offset = Query.page(params.page, limit) || Query.offset(params._offset)
    delete params.offset
    delete params.page

    let order = Query.order(params.order)
    delete params.order

    if (params.data) {
      params.data = Query.data(params.data)
    }

    let limitRats = false
    let rats = {}
    if (params.rats) {
      rats = {
        id: params.rats
      }
      limitRats = true
    }
    delete params.rats


    return {
      where: params,
      attributes: {
        exclude: [
          'deletedAt'
        ]
      },
      include: [
        {
          where: rats,
          model: Rat,
          as: 'rats',
          require: limitRats,
          through: {
            attributes: []
          }
        },
        {
          model: Rat,
          as: 'firstLimpet',
          require: false
        },
        {
          model: Epic,
          as: 'epics',
          require: false
        }
      ],

      order: [
        [order.field, order.direction]
      ],
      limit: limit,
      offset: offset
    }
  }

  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the direction in which to order
   */
  static order (order) {
    let direction = 'ASC'
    if (!order) {
      order = 'createdAt'
      direction = 'DESC'
    } else {
      if (order.startsWith('-')) {
        order = order.substring(1)
        direction = 'DESC'
      }
    }

    return { field: order, direction: direction }
  }

  /**
   * Create a JSONB contains comparison from an API query
   * @param {Object} data - the JSON object to compare against
   * @returns {{$contains}} A sequelize JSONB contains query
   */
  static data (data) {
    return {
      $contains: JSON.parse(data)
    }
  }

  /**
   * Create a Sequelize offset parameter from a v2 page query
   * @param {number} page - The number of pages to offset by
   * @param {number} limit - The number of results per page
   * @returns {number} - An offset parameter
   */
  static page (page, limit) {
    page = Number(page)
    if (!page) {
      return null
    }
    return (page - 1) * limit
  }

  /**
   * Create a sequelize offset parameter from a v2 offset query
   * @param {number} offset - The number of results to offset by
   * @returns {number} - An offset parameter
   */
  static offset (offset) {
    offset = Number(offset)
    if (!offset) {
      return 0
    }
    return offset
  }

  /**
   * Create a sequelize limit parameter from a v2 limit query
   * @param {number} limit - The number of results to limit to (or null for default)
   * @param {Object} user - A user object to use for validating permission level (or null for unauthenticated requests)
   * @returns {number} A limit parameter
   */
  static limit (limit, user) {
    limit = Number(limit)
    if (!limit) {
      return defaultRequestLimit
    }

    let maximumAllowedLimit = maximumUnauthenticatedLimit
    if (user) {
      maximumAllowedLimit = user.groups.contains('admin') ? maximumAdminLimit : maximumAuthenticatedLimit
    }

    return limit > maximumAllowedLimit ? maximumAllowedLimit : limit
  }
}

module.exports = Query