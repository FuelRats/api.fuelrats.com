
import BotServ from '../Anope/BotServ'
import API, {
  POST,
  websocket,
  authenticated,
  permissions
} from '../classes/API'

class IRC extends API {
  @POST('/irc/message')
  @websocket('irc', 'message')
  @authenticated
  @permissions('irc.message')
  message (ctx) {
    return BotServ.say(ctx.data.channel, ctx.data.message)
  }

  @POST('/irc/action')
  @websocket('irc', 'action')
  @authenticated
  @permissions('irc.message')
  action (ctx) {
    return BotServ.act(ctx.data.channel, ctx.data.message)
  }
}
module.exports = IRC
