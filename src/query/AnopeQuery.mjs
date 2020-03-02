import Query from './Query'

/**
 * @classdesc An API Query Handler for requests that need data from a Sequelize database table
 * @class
 * @augments {Query}
 */
export default class AnopeQuery extends Query {
  /**
   * @inheritdoc
   */
  get searchObject () {
    return {
    }
  }

  /**
   * @inheritdoc
   */
  get defaultSort () {
    return undefined
  }
}
