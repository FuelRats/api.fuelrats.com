
import { db } from './../db'
import StatisticsQuery from './StatisticsQuery'

/**
 * A class representing a rescue query
 */
class SystemStatisticsQuery extends StatisticsQuery {
  /**
   * Create a sequelize rescue query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)

    this._query.attributes = [
      'system',
      [this.count, 'count']
    ]

    this._query.attributes = this._query.attributes.concat(this.compare('Rescue', this.comparators))

    this._query.group = ['system']
  }

  get comparators () {
    return [{
      fields: ['outcome'],
      options: [
        ['success', 'success'],
        ['failure', 'failure'],
        ['invalid', 'invalid'],
        ['other', 'other']
      ]
    },{
      fields: ['codeRed', 'platform', 'outcome'],
      options: [
        ['codered', true, null],
        ['coderedsuccess', true, null, 'success'],
        ['coderedfailure', true, null, 'failure'],
        ['pccodered', true, 'pc'],
        ['pccoderedsuccess', true, 'pc', 'success'],
        ['pccoderedfailure', true, 'pc', 'failure'],
        ['pscodered', true, 'ps'],
        ['pscoderedsuccess', true, 'ps', 'success'],
        ['pscoderedfailure', true, 'ps', 'failure'],
        ['xbcodered', true, 'xb'],
        ['xbcoderedsuccess', true, 'xb', 'success'],
        ['xbcoderedfailure', true, 'xb', 'failure']
      ]
    },{
      fields: ['platform', 'outcome'],
      options: [
        ['pc', 'pc'],
        ['pcsuccess', 'pc', 'success'],
        ['pcfailure', 'pc', 'failure'],
        ['ps', 'ps'],
        ['pssuccess', 'ps', 'success'],
        ['psfailure', 'ps', 'failure'],
        ['xb', 'xb'],
        ['xbsuccess', 'xb', 'success'],
        ['xbfailure', 'xb', 'failure']
      ],
    }]
  }

  get count () {
    return db.fn('COUNT', 'system')
  }
}

module.exports = SystemStatisticsQuery