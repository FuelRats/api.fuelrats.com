'use strict'
const db = require('./../db').db
const StatisticsQuery = require('./StatisticsQuery')
const API = require('../classes/API')

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

    this._query.attributes = this._query.attributes.concat(API.compare('Rescue', this.comparators))

    this._query.group = ['system']
  }

  get comparators () {
    return [{
      fields: ['outcome'],
      options: [
        ['success'],
        ['failure'],
        ['invalid'],
        ['other']
      ]
    },{
      fields: ['codeRed', 'platform'],
      options: [
        [true, null, 'codered'],
        [true, 'pc', 'pccodered'],
        [true, 'ps', 'pscodered'],
        [true, 'xb', 'xbcodered']
      ]
    },{
      fields: ['platform', 'outcome'],
      options: [
        ['pc'],
        ['pc', 'success'],
        ['pc', 'failure'],
        ['ps'],
        ['ps', 'success'],
        ['ps', 'failure'],
        ['xb'],
        ['xb', 'success'],
        ['xb', 'failure']
      ],
    }]
  }

  get count () {
    return db.fn('COUNT', 'system')
  }
}

module.exports = SystemStatisticsQuery