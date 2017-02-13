'use strict'
let db = require('../db').db
let Rat = require('../db').Rat
let Query = require('./index')

/**
 * A class representing a rat query
 */
class NicknameQuery extends Query {
  /**
   * Create a sequelize rat query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)

    if (params.nickname) {
      let formattedNickname = params.nickname.replace(/\[(.*?)\]$/g, '')
      this._query.where.nicknames = {
        $overlap:  db.literal(`ARRAY[${db.escape(params.nickname)}, ${db.escape(formattedNickname)}]::citext[]`)
      }
      delete this._query.where.nickname
    }


    this._query.attributes = [
      'id',
      'createdAt',
      'updatedAt',
      'email',
      'groups',
      [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
    ]

    this._query.include = [{
      model: Rat,
      as: 'rats',
      require: false,
      attributes: {
        exclude: [
          'deletedAt'
        ]
      }
    }]
  }
}

module.exports = NicknameQuery