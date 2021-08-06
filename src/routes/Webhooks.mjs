import Announcer from '../classes/Announcer'
import Anope from '../classes/Anope'
import { InternalServerError, UnprocessableEntityAPIError } from '../classes/APIError'
import Event from '../classes/Event'
import twitter from '../classes/Twitter'
import { User, Rat, Group } from '../db'
import API, {
  authenticated,
  IPAuthenticated, permissions,
  POST,
} from './API'

const DrillType = {
  10200: 'rat',
  10201: 'dispatch',
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
          name: { ilike: cmdrName },
        },
      }],
    })

    if (!user) {
      await Announcer.sendDrillMessage(`[API] Unable to update permissions for "${cmdrName}"
      could not find a CMDR by that name.`)

      throw new UnprocessableEntityAPIError({ pointer: `/data/issue/fields/${cmdrName}` })
    }

    const permissionGroup = await Group.findOne({
      where: {
        name: DrillType[fields.issuetype.id],
      },
    })

    if (!permissionGroup) {
      throw new InternalServerError({})
    }

    await user.addGroup(permissionGroup.id)

    const updatedUser = await User.findOne({
      where: { id: user.id },
    })
    await Anope.updatePermissions(updatedUser)
    Event.broadcast('fuelrats.userupdate', ctx.state.user, updatedUser.id, {})
    await Announcer.sendDrillMessage(`[API] Permissions has been updated for user ${updatedUser.preferredRat().name}`)

    return true
  }

  /**
   * Post to Twitter webhook
   * @endpoint
   */
  @POST('/webhooks/twitter')
  @authenticated
  @permissions('twitter.write')
  async tweet (ctx) {
    const { message } = ctx.data
    await twitter.post('statuses/update', {
      status: message,
    })

    return { ok: true }
  }
}
