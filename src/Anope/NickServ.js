
import Anope from './index'
import { BadRequestAPIError, UnauthorizedAPIError } from '../classes/APIError'

const NICKNAME_PARSE_PADDING = 2
const INFO_FIRST_ITEM = 2
const INFO_SECOND_ITEM = 3
const INFO_DATE_ITEM = 5

/**
 * Class to manage requests to NickServ
 * @class
 */
class NickServ {
  /**
   * Verify authentication credentials for an account
   * @param nickname the nickname to verify the password of
   * @param password the password to verify
   * @returns {Promise}
   */
  static identify (nickname, password) {
    return Anope.checkAuthentication(nickname, password)
  }

  /**
   * Register a nickname
   * @param nickname the nickname to register
   * @param password the password to use for the nickname
   * @param email the email to use for the nickname
   * @returns {Promise.<*>}
   */
  static async register (nickname, password, email) {
    let result = await Anope.command('NickServ', nickname, `REGISTER ${password} ${email}`)
    if (result === true) {
      return nickname
    }
  }

  /**
   * Group a nickname to an existing account
   * @param nickname The nickname to group
   * @param account The base account to grup the nickname to
   * @param password The password of the base account
   * @returns {Promise.<*>}
   */
  static async group (nickname, account, password) {
    await Anope.command('NickServ', nickname, `GROUP ${account} ${password}`)
    return nickname
  }

  /**
   * List the group names of an account
   * @param account the account nickname to get the group names form
   * @returns {Promise.<*|Array>}
   */
  static async list (account) {
    let result = await Anope.command('NickServ', account, `GLIST ${account}`)

    let nicknames = result.return.split('#xA;')
    // Remove column headers and footer
    nicknames = nicknames.slice(NICKNAME_PARSE_PADDING, nicknames.length - NICKNAME_PARSE_PADDING)

    // Retrieve only the actual nickname from each nickname line
    nicknames = nicknames.map(function (nickname) {
      return nickname.split(' ')[0]
    })
    return nicknames
  }

  /**
   * Drop a registered nickname from NickServ
   * @param nickname The nickname to drop
   * @returns {Promise.<*>}
   */
  static async drop (nickname) {
    await Anope.command('NickServ', 'API', `DROP ${nickname}`)
    return nickname
  }

  /**
   * Get info about a registered nickname
   * @param nickname the nickname to get information about
   * @returns {Promise.<*>}
   */
  static async info (nickname) {
    let result = await Anope.command('NickServ', nickname, `INFO ${nickname}`)
    return new IRCUserInfo(result.return.split('#xA;'))
  }

  /**
   * Confirm the registration of a nickname
   * @param nickname the nickname to confirm
   * @returns {Promise.<*>}
   */
  static async confirm (nickname) {
    await Anope.command('NickServ', 'API', `CONFIRM ${nickname}`)
    return nickname
  }

  /**
   * Update hostmasks, usermodes and state of a nickname on the server
   * @param nickname the nickname to update
   * @returns {Promise.<*>}
   */
  static async update (nickname) {
    await Anope.command('NickServ', nickname, 'UPDATE')
    return nickname
  }
}

class IRCUserInfo {
  constructor (info) {
    for (let line of info) {
      // Trim spaces from line and remove superflous & at the end
      line = line.trim().replace(/&/g, '')
      let components = line.split(' ')

      if (components[1] === 'is' && components[INFO_FIRST_ITEM] === 'a') {
        // User privilege / ircop line
        this.privilege = components.slice(INFO_SECOND_ITEM, components.length).join(' ')
      } else if (components[1] === 'is') {
        // Nickname and real name line
        [ this.nickname ] = components
        this.realname = components.slice(INFO_FIRST_ITEM, components.length).join(' ')
      } else {
        switch (components[0]) {
          case 'Email':
            // Email line
            this.email = components[INFO_FIRST_ITEM]
            break

          case 'Online':
            // Hostmask line
            if (this.hostmask) {
              this.vhost = components[INFO_FIRST_ITEM]
            } else {
              this.hostmask = components[INFO_FIRST_ITEM]
            }
            break

          case 'Registered:':
            // Registered date line
            this.registered = Date.parse(components.slice(1, INFO_DATE_ITEM).join(' '))
            break

          case 'Expires:':
            // Expire date line
            this.expires = Date.parse(components.slice(1, INFO_DATE_ITEM).join(' '))
            break

          case 'Options:':
            // User flags line
            this.options = []
            for (let option of components.slice(1, components.length - 1)) {
              if (option.endsWith(',')) {
                this.options.push(option.substring(0, option.length - 1))
              } else {
                this.options.push(option)
              }
            }
            break

          default:
            break
        }
      }
    }
  }
}

module.exports = NickServ