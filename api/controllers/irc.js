'use strict'
const Errors = require('../errors')
const BotServ = require('../Anope/BotServ')

class IRC {
  static message (ctx) {
    if (!ctx.data.channel || ctx.data.channel.length === 0) {
      throw Errors.template('missing_required_field', 'channel')
    } else if (!ctx.data.message || ctx.data.message.length === 0) {
      throw Errors.template('missing_required_field', 'message')
    }

    return BotServ.say(ctx.data.channel, ctx.data.message)
  }

  static action (ctx) {
    if (!ctx.data.channel || ctx.data.channel.length === 0) {
      throw Errors.template('missing_required_field', 'channel')
    } else if (!ctx.data.message || ctx.data.message.length === 0) {
      throw Errors.template('missing_required_field', 'message')
    }

    return BotServ.act(ctx.data.channel, ctx.data.message)
  }
}
module.exports = IRC
