import Query, { SortOrder } from '.'

/**
 * @classdesc An API Query Handler for requests that need data from a Sequelize database table
 * @class
 * @augments {Query}
 */
export default class DatabaseQuery extends Query {

  /**
   * @inheritDoc
   */
  get searchObject () {
    return {
      where: this.filter,
      offset: this.offset,
      limit: this.limit,
      order: this.sort.map(({ field, sort }) => {
        const sequelizeOrder = SortOrder.toSQL(sort)
        return [field, sequelizeOrder]
      })
    }
  }

  /**
   * @inheritDoc
   */
  get defaultSort () {
    return [{
      field: 'createdAt',
      sort: SortOrder.ascending
    }]
  }
}
