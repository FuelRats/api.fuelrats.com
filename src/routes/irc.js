
import BotServ from '../Anope/BotServ'
import API from '../classes/API'

class IRC extends API {
  message (ctx) {
    return BotServ.say(ctx.data.channel, ctx.data.message)
  }

  action (ctx) {
    return BotServ.act(ctx.data.channel, ctx.data.message)
  }
}
module.exports = IRC
