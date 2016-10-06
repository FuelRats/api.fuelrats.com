'use strict'
let Rat = require('./../db').Rat
let Epic = require('./../db').Epic
let Query = require('./index')

/**
 * A class representing a rescue query
 */
class RescueQuery extends Query {
  /**
   * Create a sequelize rescue query from a set of parameters
   * @constructor
   * @param params
   * @param connection
   */
  constructor (params, connection) {
    super(params, connection)

    let limitRats = false
    let rats = {}
    if (this._params.rats) {
      rats = {
        id: this._params.rats
      }
      limitRats = true
    }
    delete this._params.rats

    this._query.attributes = {
      exclude: [
        'deletedAt'
      ]
    }

    this._query.include = [
      {
        where: rats,
        model: Rat,
        as: 'rats',
        require: limitRats,
        through: {
          attributes: []
        }
      },
      {
        model: Rat,
        as: 'firstLimpet',
        require: false
      },
      {
        model: Epic,
        as: 'epics',
        require: false
      }
    ]
  }
}

module.exports = RescueQuery