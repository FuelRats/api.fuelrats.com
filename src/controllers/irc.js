
import BotServ from '../Anope/BotServ'
import APIEndpoint from '../APIEndpoint'

class IRC extends APIEndpoint {
  message (ctx) {
    return BotServ.say(ctx.data.channel, ctx.data.message)
  }

  action (ctx) {
    return BotServ.act(ctx.data.channel, ctx.data.message)
  }
}
module.exports = IRC
