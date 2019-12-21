import { UnprocessableEntityAPIError } from '../classes/APIError'
import enumerable from '../classes/Enum'
import { Context } from '../classes/Context'

const fieldsRegex = /^fields\[([a-z-]*)\]$/gu
const pageRegex = /^page\[([a-z]*)\]$/gu
const defaultOffset = 0
const defaultLimit = 100
const defaultSize = 25

@enumerable
/**
 * Enumerable representing the different sort orders a query can have
 * @readonly
 * @enum {symbol}
 * @property {symbol} ascending the query is sorted in ascending order
 * @property {symbol} descending the query is sorted in descending order
 */
export class SortOrder {
  static ascending
  static descending

  /**
   * Return SQL compatible representation of SortOrder
   * @param {SortOrder} sortOrder a SortOrder value
   * @returns {string|undefined} an SQL compatible representation of SortOrder
   */
  static toSQL (sortOrder) {
    switch (sortOrder) {
      case this.ascending:
        return 'ASC'

      case this.descending:
        return 'DESC'

      default:
        return undefined
    }
  }
}

/**
 * @classdesc API Query Handler
 * @class
 */
export default class Query {
  connection = undefined
  cachedViewPermissions = {}

  /**
   * Create a new instance of an API Query
   * @param {object} arg function arguments object
   * @param {Context} arg.connection request context
   */
  constructor ({ connection }) {
    this.connection = connection
  }

  /**
   * Get the implementation specific generated object that is sent to the data layer for query
   * @returns {object} Implementation specific generated search object
   * @abstract
   */
  get searchObject () {
    return undefined
  }

  /**
   * Get page query information like page number, offset, or limit parsed from the API Query
   * @returns {{number: number, size: number, offset: number, limit: number}}  Page query information
   */
  get page () {
    const { page = {} } = this.connection.query

    return Object.entries(page).reduce((acc, [key, value]) => {
      const parsedValue = Number(value)
      if (Number.isInteger(parsedValue) && parsedValue >= 0) {
        acc[key] = parsedValue
      } else {
        throw new UnprocessableEntityAPIError({
          parameter: `page[${key}]`
        })
      }
      return acc
    }, {
      number: undefined,
      size: undefined,
      offset: undefined,
      limit: undefined
    })
  }

  /**
   * Get the offset to request, parsed from the API Query
   * @returns {number} Offset (number of records from 0) that is being requested in the query
   */
  get offset () {
    const { number, size = defaultSize, offset = defaultOffset } = this.page
    if (number) {
      return (number - 1) * size
    }
    return offset
  }

  /**
   * Get the limit of the request, parsed from the API Query
   * @returns {number} Limit (number of records to display) that is being requested in the query
   */
  get limit () {
    const { number, size = defaultSize, limit = defaultLimit } = this.page
    if (number) {
      return size
    }
    return limit
  }

  /**
   * Get the result fields to display, parsed from the API Query
   * @returns {object} Get the subset of resulting fields to display, parsed from the API Query
   */
  get fields () {
    const { fields = {} } = this.connection.query

    return Object.entries(fields).reduce((acc, [key, value]) => {
      acc[key] = value.split(',')
      return acc
    }, {})
  }

  /**
   * Get the requested sorting field and order, parsed from the API query
   * @returns {{field: string, sort: SortOrder}[]} requested sorting order
   */
  get sort () {
    const { sort } = this.connection.query

    if (!sort) {
      return this.defaultSort
    }
    return sort.split(',').map((orderItem) => {
      if (orderItem.startsWith('-')) {
        return {
          field: orderItem.substring(1),
          sort: SortOrder.descending
        }
      }
      return {
        field: orderItem,
        sort: SortOrder.ascending
      }
    })
  }

  /**
   * Get the subset of relationships that should have related data included in the query
   * @returns {string[]|undefined} subset of relationships that should have related data included in the query
   */
  get include () {
    const { include } = this.connection
    if (!include) {
      return undefined
    }
    return include.split(',')
  }

  /**
   * Get the default sort field and order for Queries on this resource
   * @returns {*} default sort field
   * @abstract
   */
  get defaultSort () {
    return undefined
  }

  /**
   * Get the filtering query to be applied to results of the request
   * @returns {object} Requested filtering to be performed on the results of the request
   */
  get filter () {
    const { filter } = this.connection.query
    if (!filter) {
      return {}
    }
    if (typeof filter === 'string') {
      try {
        return JSON.parse(filter)
      } catch (ex) {
        throw new UnprocessableEntityAPIError({
          parameter: 'filter'
        })
      }
    }
    return filter
  }
}
