'use strict'
const Rat = require('./../db').Rat
const Epic = require('./../db').Epic
const Query = require('./index')

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

    this._query.distinct = true

    this._query.attributes = {
      exclude: [
        'deletedAt'
      ]
    }

    let rats = {}
    if (this._params.rats) {
      rats = this.subQuery(this._params.rats)
      delete this._params.rats
    }

    let firstLimpet = {}
    if (this._params.firstLimpet) {
      firstLimpet = this.subQuery(this._params.firstLimpet)
      delete this._params.firstLimpet
    }

    let epics = {}
    if (this._params.epics) {
      epics = this.subQuery(this._params.epics)
      delete this._params.epics
    }

    this._query.where = this._params

    this._query.include = [
      {
        where: rats,
        model: Rat,
        as: 'rats',
        require: false,
        through: {
          attributes: []
        }
      },
      {
        where: firstLimpet,
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