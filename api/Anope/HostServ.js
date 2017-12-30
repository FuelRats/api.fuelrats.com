'use strict'
const Anope = require('./index')
const NickServ = require('./NickServ')
const Permissions = require('../permission')
const { User } = require('../db')
const { GroupsPresenter } = require('../classes/Presenters')


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

    /*  Temporarily removed due to a bug in Anope causing crashes in certain unknown circumstances  */
    // NickServ.update(user.data.attributes.nicknames[0])
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
    let preferredRat = User.preferredRat(user)
    let ircSafeName = getIRCSafeName(preferredRat)

    return `${ircSafeName}.${group.attributes.vhost}`
  }
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

/**
 * Gets the group the user is a part of that has the highest priority defined
 * @param user the user to get the highest priority group from
 * @returns {T} the highest priority group
 */
function getHighestPriorityGroup (user) {
  let groups = user.included.filter((include) => {
    return include.type === 'groups' && include.attributes.vhost
  })

  let defaultGroup = Permissions.groups.find((group) => {
    return group.id === 'default'
  })

  groups.push(GroupsPresenter.render(defaultGroup).data)

  groups.sort((group1, group2) => {
    return group1.priority - group2.priority
  })
  return groups[0]
}

module.exports = HostServ