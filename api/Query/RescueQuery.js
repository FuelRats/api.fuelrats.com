'use strict'
const { Rat, Epic } = require('./../db')
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

    if (this._params.outcome === 'null') {
      this._params.outcome = {
        $eq: null
      }
    }
    this._query.where = this._params

    this._query.include = [
      {
        where: rats,
        model: Rat,
        as: 'rats',
        required: false,
        through: {
          attributes: []
        }
      },
      {
        where: firstLimpet,
        model: Rat,
        as: 'firstLimpet',
        required: false
      },
      {
        where: epics,
        model: Epic,
        as: 'epics',
        required: false
      }
    ]
  }
}

module.exports = RescueQuery