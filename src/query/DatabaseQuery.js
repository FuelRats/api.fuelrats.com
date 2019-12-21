import Query, { SortOrder } from '.'

/**
 * @classdesc An API Query Handler for requests that need data from a Sequelize database table
 * @class
 * @augments {Query}
 */
export default class DatabaseQuery extends Query {

  /**
   * @inheritdoc
   */
  get searchObject () {
    return {
      where: this.filter,
      order: this.sort.map(({ field, sort }) => {
        const sequelizeOrder = SortOrder.toSQL(sort)
        return [field, sequelizeOrder]
      }),
      offset: this.offset,
      limit: this.limit
    }
  }

  /**
   * @inheritdoc
   */
  get defaultSort () {
    return [{
      field: 'createdAt',
      sort: SortOrder.ascending
    }]
  }
}
