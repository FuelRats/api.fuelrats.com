

import HostServ from '../../Anope/HostServ'
import BotServ from '../../Anope/BotServ'
import { User, Rat } from '../../db'
import Users from '../user'
import { UnprocessableEntityAPIError } from '../../classes/APIError'

const DrillType = {
  10200: 'rat',
  10201: 'dispatch'
}
const CMDRnameField = 'customfield_10205'
const emailAddressField = 'customfield_10502'

class JiraDrill {
  static async update (ctx) {
    if (!ctx.data.issue || !ctx.data.issue.fields.issuetype || !ctx.data.issue.fields.issuetype.id) {
      throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/issue/fields/issuetype/id' })
    }

    let { fields } = ctx.data.issue

    let email = fields[emailAddressField]
    if (!email) {
      BotServ.say('#doersofstuff', '[API] Unable to update drilled status or IRC permissions. Email was not provided')
      throw new UnprocessableEntityAPIError({ pointer: `/data/attributes/issue/fields/${emailAddressField}` })
    }

    let CMDRname = fields[CMDRnameField]
    if (!CMDRname) {
      BotServ.say('#doersofstuff', '[API] Unable to update IRC permissions. CMDR name was not provided')
      throw new UnprocessableEntityAPIError({ pointer: `/data/attributes/issue/fields/${CMDRnameField}` })
    }

    let user = await User.findOne({
      where: {
        email: {$iLike: email}
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
              CMDRname: {
                $iLike: CMDRname
              }
            }
          }
        ]
      })
    }

    if (!user) {
      BotServ.say('#doersofstuff',
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
    BotServ.say('#doersofstuff', `[API] Drilled status and IRC permissions updated for ${displayRat.attributes.name} (user ${user.id})`)
    return userResponse
  }
}

module.exports = JiraDrill