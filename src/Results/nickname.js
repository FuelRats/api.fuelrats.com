'use strict'

let Result = require('./index')

/**
 * Class for generating an API IRC nickname result from an anope result
 */
class NicknameResult extends Result {
  constructor (dbResult, params, canViewPrivateInfo) {
    super(dbResult, params)

    if (!canViewPrivateInfo) {
      for (let user of this._result) {
        user.email = null
      }
    }
  }
}

module.exports = NicknameResult