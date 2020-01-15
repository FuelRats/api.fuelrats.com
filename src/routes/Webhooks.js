import { User, Rat } from '../db'
import { UnprocessableEntityAPIError } from '../classes/APIError'
import API, {
  IPAuthenticated,
  POST
} from './API'
import Announcer from '../classes/Announcer'

const DrillType = {
  10200: 'rat',
  10201: 'dispatch'
}
const cmdrNameField = 'customfield_10205'

/**
 * Class managing webhooks endpoints
 */
export default class Webhooks extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'webhooks'
  }

  /**
   * Jira Drill Update webhook
   * @endpoint
   */
  @POST('/webhooks/jira')
  @IPAuthenticated
  async jira (ctx) {
    if (!ctx.data.issue || !ctx.data.issue.fields.issuetype || !ctx.data.issue.fields.issuetype.id) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/issue/fields/issuetype/id' })
    }

    const { fields } = ctx.data.issue
    const cmdrName = fields[cmdrNameField]

    const user = await User.findOne({
      where: {},
      include: [{
        model: Rat,
        as: 'rats',
        required: true,
        where: {
          name: { ilike: cmdrName }
        }
      }]
    })

    if (!user) {
      await Announcer.sendDrillMessage(`[API] Unable to update permissions for "${cmdrName}" 
      could not find a CMDR by that name.`)

      throw new UnprocessableEntityAPIError({ pointer: `/data/issue/fields/${cmdrName}` })
    }

    const groupId = DrillType[fields.issuetype.id]
    await user.addGroup(groupId)
    await Announcer.sendDrillMessage(`[API] Permissions has been updated for user ${user.preferredRat().name}`)

    return true
  }
}
