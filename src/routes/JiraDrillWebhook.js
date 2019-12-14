/* eslint-disable */


import { User, Rat } from '../db/index'
import Users from './Users'
import { UnprocessableEntityAPIError } from '../classes/APIError'
import API, {
  IPAuthenticated,
  POST
} from '../classes/API'

const DrillType = {
  10200: 'rat',
  10201: 'dispatch'
}
const CMDRnameField = 'customfield_10205'
const emailAddressField = 'customfield_10502'

export default class JiraDrillWebhook extends API {
  @POST('/jira/drill')
  @IPAuthenticated
  async update (ctx) {
    if (!ctx.data.issue || !ctx.data.issue.fields.issuetype || !ctx.data.issue.fields.issuetype.id) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/issue/fields/issuetype/id' })
    }

    let { fields } = ctx.data.issue

    let email = fields[emailAddressField]
    if (!email) {
      // BotServ.say(global.OVERSEER_CHANNEL,
      //   '[API] Unable to update drilled status or IRC permissions. Email was not provided')
      throw new UnprocessableEntityAPIError({ pointer: `/data/attributes/issue/fields/${emailAddressField}` })
    }

    let cmdrName = fields[CMDRnameField]
    if (!cmdrName) {
      // BotServ.say(global.OVERSEER_CHANNEL,
      //   '[API] Unable to update IRC permissions. CMDR name was not provided')
      throw new UnprocessableEntityAPIError({ pointer: `/data/attributes/issue/fields/${CMDRnameField}` })
    }

    let user = await User.findOne({
      where: {
        email: {ilike: email}
      }
    })

    if (!user) {
      user = await User.findOne({
        where: {},
        include: [
          {
            model: Rat,
            as: 'rats',
            required: true,
            where: {
              name: {
                ilike: cmdrName
              }
            }
          }
        ]
      })
    }

    if (!user) {
      BotServ.say(global.OVERSEER_CHANNEL,
        'Unable to update drilled status or IRC permissions, could not find user by either CMDR name or email')
      throw new UnprocessableEntityAPIError({ pointer: `/data/attributes/issue/fields/${CMDRnameField}` })
    }

    let groupId = DrillType[fields.issuetype.id]
    await user.addGroup(groupId)

    let userInstance = await User.scope('internal').findOne({
      where: {id: user.id}
    })

    let userResponse = Users.presenter.render(userInstance, {})
    await HostServ.update(userResponse)

    let displayRat = User.preferredRat(userResponse)
    BotServ.say(global.OVERSEER_CHANNEL,
      `[API] Drilled status and IRC permissions updated for ${displayRat.attributes.name} (user ${user.id})`)
    return userResponse
  }
}
