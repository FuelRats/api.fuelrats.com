import Query, { SortOrder } from '.'

/**
 * @classdesc An API Query Handler for requests that need data from a Sequelize database table
 * @class
 * @augments {Query}
 */
export default class AnopeQuery extends Query {

  /**
   * @inheritDoc
   */
  get searchObject () {
    return {
    }
  }

  /**
   * @inheritDoc
   */
  get defaultSort () {
    return undefined
  }
}
