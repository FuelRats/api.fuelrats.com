import { BadRequestAPIError } from '../classes/APIError'
import validateFilter from '../helpers/validateFilter'
import Query, { SortOrder } from './Query'

/**
 * @classdesc An API Query Handler for requests that need data from a Sequelize database table
 * @class
 * @augments {Query}
 */
export default class DatabaseQuery extends Query {
  view = undefined
  selfScoped = false

  /**
   * Create a new instance of a database API Query
   * @param {object} arg function arguments object
   * @param {Context} arg.connection request context
   * @param {boolean} [arg.validate] whether to validate query parameters (true by default)
   * @param {Function} [arg.view] the View class whose read permissions scope filter/sort columns
   * @param {boolean} [arg.selfScoped] whether the query is limited to the caller's own rows
   */
  constructor ({ connection, validate = true, view = undefined, selfScoped = false }) {
    super({ connection, validate })
    this.view = view
    this.selfScoped = selfScoped
  }

  /**
   * The columns the caller may filter and sort on for this query's view
   * @returns {Set<string>} filterable column names
   */
  get filterableFields () {
    if (!this.view) {
      return undefined
    }
    const instance = new this.view({ object: undefined, query: this })
    return new Set(instance.filterableFields({ selfScoped: this.selfScoped }))
  }

  /**
   * Validate the filter, sort, and include against the columns this caller may read. Only runs
   * when a view is supplied (the collection-search endpoints); other callers keep prior behaviour.
   * @throws {BadRequestAPIError} if a disallowed column, operator, or relationship is referenced
   */
  assertValidQuery () {
    if (!this.view) {
      return
    }
    const filterable = this.filterableFields
    validateFilter(this.filter, filterable)

    this.sort.forEach(({ field }) => {
      if (filterable.has(field) === false) {
        throw new BadRequestAPIError({ parameter: 'sort' })
      }
    })

    if (this.include) {
      const instance = new this.view({ object: undefined, query: this })
      const relationships = new Set(Object.keys(instance.relationships ?? {}))
      this.include.forEach((relationship) => {
        if (relationships.has(relationship) === false) {
          throw new BadRequestAPIError({ parameter: 'include' })
        }
      })
    }
  }

  /**
   * @inheritdoc
   */
  get searchObject () {
    this.assertValidQuery()
    return {
      where: this.filter,
      order: this.sort.map(({ field, sort }) => {
        const sequelizeOrder = SortOrder.toSQL(sort)
        return [field, sequelizeOrder]
      }),
      offset: this.offset,
      limit: this.limit,
    }
  }

  /**
   * @inheritdoc
   */
  get defaultSort () {
    return [{
      field: 'createdAt',
      sort: SortOrder.ascending,
    }]
  }
}
