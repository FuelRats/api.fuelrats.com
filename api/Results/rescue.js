'use strict'

const Result = require('./index')
const Rescue = require('../db').Rescue
const Rat = require('../db').Rat
const JSONAPISerializer = require('jsonapi-serializer').Serializer

/**
 * Class for generating an API rescue result from a database result
 */
class RescueResult extends Result {
  constructor (dbResult, params) {
    super(dbResult, params)
    this.serialiser = new JSONAPISerializer('rescues', {
      keyForAttribute: 'camelCase',
      attributes: Object.keys(Rescue.attributes),
      rats: {
        attributes: Object.keys(Rat.attributes),
        ref: 'id',
        included: true
      },
      typeForAttribute: function (v1, v2) {
        return 'rats'
      }
    })
  }

  toResponse () {
    return this.serialiser.serialize(this._result)
  }
}



module.exports = RescueResult