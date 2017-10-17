'use strict'

const HostServ = require('../../Anope/HostServ')
const BotServ = require('../../Anope/BotServ')
const { User, Rat } = require('../../db')
const Errors = require('../../errors')
const { UsersPresenter } = require('../../classes/Presenters')

const DrillType = {
  10200: 'rat',
  10201: 'dispatch'
}
const CMDRnameField = 'customfield_10205'
const emailAddressField = 'customfield_10502'

class JiraDrill {
  static async update (ctx) {
    if (!ctx.data.issue || !ctx.data.issue.fields.issuetype || !ctx.data.issue.fields.issuetype.id) {
      throw Errors.template('missing_required_field', 'issue.fields.issuetype.id')
    }

    let { fields } = ctx.data.issue

    let email = fields[emailAddressField]
    if (!email) {
      BotServ.say('#doersofstuff', '[API] Unable to update drilled status or IRC permissions. Email was not provided')
      throw Errors.template('missing_required_field', `'issue.fields.${emailAddressField}`)
    }

    let CMDRname = fields[CMDRnameField]
    if (!CMDRname) {
      BotServ.say('#doersofstuff', '[API] Unable to update IRC permissions. CMDR name was not provided')
      throw Errors.template('missing_required_field', `'issue.fields.${CMDRnameField}`)
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
      throw Errors.template('not_found', `'issue.fields.${CMDRnameField}`)
    }

    let groupId = DrillType[fields.issuetype.id]
    await user.addGroup(groupId)

    let userInstance = await User.scope('internal').findOne({
      where: {id: user.id}
    })

    let userResponse = UsersPresenter.render(userInstance, {})
    await HostServ.update(userResponse)
    BotServ.say('#doersofstuff', `[API] Drilled status and IRC permissions updated for ${user.email}`)
    return userResponse
  }
}

module.exports = JiraDrill