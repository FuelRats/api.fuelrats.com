'use strict'
const Anope = require('./index')
const ChanServ = require('./ChanServ')
const NickServ = require('./NickServ')
const Permissions = require('../permission')
const GroupsPresenter = require('../classes/Presenters').GroupsPresenter

const officialChannels = [
  '#fuelrats',
  '#drillrats',
  '#drillrats2',
  '#drillrats3',
  '#ratchat',
  '#rat-ops',
  '#rattech',
  '#doersofstuff'
]

/**
 * Class for managing requests to HostServ
 * @class
 */
class HostServ {
  /**
   * Manually set a hostname on a particular account
   * @param nickname The host nickname of this account
   * @param host The hostname to set
   * @returns {Promise.<*>}
   */
  static async set (nickname, host) {
    let result = await Anope.command('HostServ', 'API', `SETALL ${nickname} ${host}`)
    if (/not registered/.test(result.return) === true) {
      throw result.return
    }

    return host
  }

  /**
   * Update the IRC hostname of a user
   * @param user User object to generate and set the hostnames on
   * @returns {Promise.<void>}
   */
  static async update (user) {
    let virtualHost = generateVirtualHost(user)
    if (!virtualHost) {
      throw null
    }

    await HostServ.set(user.data.attributes.nicknames[0], virtualHost)

    //officialChannels.forEach(ChanServ.sync)
    NickServ.update(user.data.attributes.nicknames[0])
    return virtualHost
  }
}

/**
 * Generate a virtual host for a user
 * @param user The user to use as a base for generating the user object
 * @returns {*}
 */
function generateVirtualHost (user) {
  let group = getHighestPriorityGroup(user)

  if (group.attributes.isAdministrator) {
    return group.attributes.vhost
  } else {
    let preferredRat = getPreferredRat(user)
    let ircSafeName = getIRCSafeName(preferredRat)

    return `${ircSafeName}.${group.attributes.vhost}`
  }
}
/**
 * Get the preferred display rat of an account
 * @param user the user account to get the display rat of
 * @returns {*}
 */
function getPreferredRat (user) {
  let ratRef = (user.data.relationships.displayRat.data || user.data.relationships.rats.data[0])
  if (!ratRef) {
    return null
  }

  return user.included.find((include) => {
    return include.id === ratRef.id
  })
}

/**
 * Get an IRC safe representation of a CMDR name
 * @param rat the rat to get an IRC safe name from
 * @returns {string} An IRC safe name
 */
function getIRCSafeName (rat) {
  let ratName = rat.attributes.name
  ratName = ratName.replace(/ /g, '')
  ratName = ratName.replace(/[^a-zA-Z0-9\s]/g, '')
  return ratName.toLowerCase()
}

function getHighestPriorityGroup (user) {
  let groups = user.included.filter((include) => {
    return include.type === 'groups' && include.attributes.vhost
  })

  let defaultGroup = Permissions.groups.find((group) => {
    return group.id === 'default'
  })

  groups.push(GroupsPresenter.render(defaultGroup).data)

  groups.sort((a, b) => {
    return a.priority > b.priority
  })
  return groups[0]
}

module.exports = HostServ