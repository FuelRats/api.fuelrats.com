'use strict'

const Result = require('./index')

/**
 * Class for generating an API IRC nickname result from an anope resul
 */
class NicknameInfoResult extends Result {
  constructor (info, params, group) {
    super(info, params)

    if (group !== 'admin') {
      if (info.vhost) {
        info.hostmask = info.vhost
        delete info.vhost
      }
      delete info.email
    }
  }

  result (dbResult) {
    return dbResult
  }
}

module.exports = NicknameInfoResult