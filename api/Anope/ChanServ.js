'use strict'
const Anope = require('./index')

/**
 * Class for managing requests to ChanServ
 */
class ChanServ {
  /**
   * Sync the state of a channel
   * @param channel the channel to sync
   * @returns {Promise}
   */
  static sync (channel) {
    return Anope.command('ChanServ', 'API', `SYNC ${channel}`)
  }
}


module.exports = ChanServ