'use strict'
let Rat = require('./../db/index').Rat
let Epic = require('./../db/index').Epic

const defaultRequestLimit = 25
const maximumUnauthenticatedLimit = 100
const maximumAuthenticatedLimit = 1000
const maximumAdminLimit = 5000


/**
 * Class representing a Sequelize database query constructed from an API request
 */
class Query {
  /**
   * Create a Sequelize query from a set of parameters
   * @constructor
   * @param {Object} params - API request parameters
   * @param {Object} connection - A websocket or Express connection object
   */
  constructor (params, connection) {
    this._params = params
    this._connection = connection

    delete this._params.fields

    let limit = Query.limit(this._params.limit, this._connection.user)
    delete this._params.limit

    let offset = Query.page(this._params.page, limit) || Query.offset(this._params._offset)
    delete this._params.offset
    delete this._params.page

    let order = Query.order(this._params.order)
    delete this._params.order

    if (this._params.data) {
      this._params.data = Query.data(this._params.data)
    }

    this._query = {
      where: this._params,
      order: [
        [order.field, order.direction]
      ],
      limit: limit,
      offset: offset
    }
  }

  /**
   * Return an object containing a Sequelize-compatible query generated from the parameters
   * @returns {{where: (Object|*), order: *[], limit: number, offset: number}|*} A sequelize compatible query
   */
  get toSequelize () {
    return this._query
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