'use strict'

let Result = require('./index')

/**
 * Class for generating an API IRC nickname result from an anope resul
 */
class NicknameResult extends Result {
  constructor (dbResult, params) {
    super(dbResult, params)
  }
}

module.exports = NicknameResult