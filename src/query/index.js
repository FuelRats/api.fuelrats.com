
import QueryOptions from './QueryOptions'

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
    this._params = Object.assign({}, params)
    this._connection = connection
    this.options = new QueryOptions()

    delete this._params.fields

    this._limit = this.limit(this._params.limit, this._connection.user)
    delete this._params.limit

    this._offset = this.page(this._params.page, this._limit) || this.offset(this._params._offset)
    delete this._params.offset
    delete this._params.page

    let order = this.order(this._params.order)
    delete this._params.order

    if (this._params.data) {
      this._params.data = this.data(this._params.data)
    }

    this._params = this.subQuery(this._params)

    this._query = {
      where: this._params,
      order: [
        [order.field, order.direction]
      ],
      limit: this._limit,
      offset: this._offset
    }
  }

  /**
   * Return an object containing a Sequelize-compatible query generated from the parameters
   * @returns {{where: (Object|*), order: (Array|*), limit: number, offset: number}|*} A sequelize compatible query
   */
  get toSequelize () {
    return this._query
  }

  /**
   * Create a sequelize order parameter from a v2 order query
   * @param order a column to order the query by, optionally prefixed by a - to order descending
   * @returns {{field: *, direction: string}} An object containing the field to order by and the order direction
   */
  order (order) {
    let direction = 'ASC'
    if (!order) {
      order = this.defaultSortField
      direction = this.defaultSortDirection
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
  data (data) {
    return {
      $contains: JSON.parse(data)
    }
  }

  /**
   * Create a Sequelize offset parameter from a v2 page query
   * @param {number} page - The number of pages to offset by
   * @param {number} limit - The number of results per page
   * @returns {?number} - An offset parameter
   */
  page (page, limit) {
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
  offset (offset) {
    offset = Number(offset)
    if (!offset) {
      return 0
    }
    return offset
  }

  /**
   * Create a sequelize limit parameter from a v2 limit query
   * @param {number} limit - The number of results to limit to (or null for default)
   * @param {Object} user - A user object to use for validating permission level
   * @returns {number} A limit parameter
   */
  limit (limit, user) {
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

  subQuery (params) {
    /* Iterate through every key value pair in the query */
    for (let key of Object.keys(params)) {
      if (params[key] instanceof Object) {
        /* This query parameter has a sub query */
        for (let subQuery of Object.keys(params[key])) {
          /* Check if we have a sub query function available in the QueryOptions class to process this sub query, */
          if (params[key][subQuery] && this.options[subQuery]) {
            params[key] = this.options[subQuery].call(this, params[key], subQuery)
          }
        }
      }
    }
    return params
  }

  /**
   * Get the current default sort field for queries where a sort is not specified
   * @returns {string} the default sort field
   */
  get defaultSortField () {
    return 'createdAt'
  }

  /**
   * Get the current default sort direction for queries where a sort is not specified
   * @returns {string} the default sort direction
   */
  get defaultSortDirection () {
    return 'DESC'
  }

}

module.exports = Query