import Query, { SortOrder } from './Query'
import { UnprocessableEntityAPIError } from '../classes/APIError'

const leaderBoardFields = [
  'preferredName',
  'ratNames',
  'joinedAt',
  'rescueCount',
  'codeRedCount',
  'isDispatch',
  'isEpic'
]

/**
 * Query the leaderboard for results
 */
export default class LeaderboardQuery extends Query {
  /**
   * @inheritdoc
   */
  get searchObject () {
    return {
      filter: this.filter,
      order: this.sort.map(({ field, sort }) => {
        if (leaderBoardFields.includes(field) === false) {
          throw new UnprocessableEntityAPIError({ parameter: 'sort' })
        }
        const sequelizeOrder = SortOrder.toSQL(sort)
        return `"${field}" ${sequelizeOrder}`
      }).join(', '),
      offset: this.offset,
      limit: this.limit
    }
  }

  /**
   * @inheritdoc
   */
  get defaultSort () {
    return [{
      field: 'rescueCount',
      sort: SortOrder.descending
    }]
  }
}
