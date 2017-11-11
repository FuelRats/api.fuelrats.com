'use strict'
const Anope = require('./index')

/**
 * Class to manage requests to BotServ
 * @class
 */
class BotServ {
  /**
   * Send an IRC message to a channel as a BotServ bot
   * @param channel the channel to message
   * @param message the message to send
   */
  static say (channel, message) {
    return Anope.command('BotServ', 'API', `SAY ${channel} ${message}`)
  }

  /**
   * Send a CTCP ACTION to a channel as a BotServ bot
   * @param channel the channel to message
   * @param message the action message to send
   */
  static act (channel, message) {
    return Anope.command('BotServ', 'API', `ACT ${channel} ${message}`)
  }
}


module.exports = BotServ