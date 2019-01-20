import Query, { SortOrder } from '.'


export default class DatabaseQuery extends Query {
  get searchObject () {
    return {
      where: this.filter,
      offset: this.offset,
      limit: this.limit,
      order: this.sort.map(([field, order]) => {
        const sequelizeOrder = SortOrder.toSQL(order)
        return [field, sequelizeOrder]
      })
    }
  }

  get defaultSort () {
    return [{
      field: 'createdAt',
      sort: SortOrder.ascending
    }]
  }
}
