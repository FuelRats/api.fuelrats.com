import { UnprocessableEntityAPIError } from '../classes/APIError'
import enumerable from '../classes/Enum'

const fieldsRegex = /^fields\[([a-z-]*)\]$/gu
const pageRegex = /^page\[([a-z]*)\]$/gu
const defaultOffset = 0
const defaultLimit = 100
const defaultSize = 25

@enumerable
export class SortOrder {
  static ascending
  static descending

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

export default class Query {
  connection = undefined

  constructor ({ connection }) {
    this.connection = connection
  }

  get searchObject () {
    return undefined
  }

  get page () {
    const { query } = this.connection

    return Object.entries(query).reduce((acc, [key, value]) => {
      const matches = key.match(pageRegex)
      if (matches) {
        const [, attribute] = matches
        acc[attribute] = Number(value)
      }
      return acc
    }, {
      number: undefined,
      size: undefined,
      offset: undefined,
      limit: undefined
    })
  }

  get offset () {
    const { number, size = defaultSize, offset = defaultOffset } = this.page
    if (number) {
      return number * size
    }
    return offset
  }

  get limit () {
    const { number, size = defaultSize, limit = defaultLimit } = this.page
    if (number) {
      return size
    }
    return limit
  }

  get fields () {
    const { query } = this.connection

    return Object.entries(query).reduce((acc, [key, value]) => {
      const matches = key.match(fieldsRegex)
      if (matches) {
        const [, type] = matches
        acc[type] = value.split(',')
      }
      return acc
    }, {})
  }

  get sort () {
    const { order } = this.connection.query

    if (!order) {
      return this.defaultSort
    }
    return order.split(',').map((orderItem) => {
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

  get include () {
    const { include } = this.connection
    if (!include) {
      return undefined
    }
    return include.split(',')
  }

  get defaultSort () {
    return undefined
  }

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
