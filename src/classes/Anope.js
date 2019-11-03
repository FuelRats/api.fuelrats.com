import knex from 'knex'
import config from '../../config'
import bcrypt from 'bcrypt'
import { ConflictAPIError } from './APIError'
import { parse } from 'date-fns'
import { User } from '../db'

const { database, username, hostname, port } = config.anope
const anopeBcryptRounds = 10
const defaultMaximumEditDistance = 5

const mysql = knex({
  client: 'mysql',
  connection: {
    host: hostname,
    port,
    user: username,
    database
  }
})

/**
 * @classdesc Class managing the interface to Anope
 * @class
 */
export default class Anope {
  /**
   * Get an account entry from Anope
   * @param {string} email The user's email
   * @returns {Promise<[Nickname]|undefined>} a list of nickname entries
   */
  static async getAccount (email) {
    const results = await mysql.select('*')
      .from('anope_db_NickCore')
      .leftJoin('anope_db_NickAlias', 'anope_db_NickCore.display', 'anope_db_NickAlias.nc')
      .whereRaw('lower(email) = lower(?)', [email])

    if (results.length > 0) {
      return results
    }
    return undefined
  }

  /**
   *
   * @param {string} email the email of the account to set the fingerprint of
   * @param {string} fingerprint the fingerprint to set
   * @returns {Promise<undefined>} resolves a promise when completed
   */
  static setFingerprint (email, fingerprint) {
    return mysql.raw(`
        UPDATE anope_db_NickCore
        SET
            cert = ?
        WHERE
            lower(anope_db_NickCore.email) = lower(?)
        `, [fingerprint, email])
  }

  /**
   * Get a list of accounts by completing a fuzzy match search on a nickname
   * @param {string} nickname the nickname to search by
   * @returns {Promise<[Nickname]>} a list of nick search results
   */
  static async findAccountFuzzyMatch (nickname) {
    const distance = Math.min(Math.ceil(nickname.length / 2), defaultMaximumEditDistance)

    const [results] = await mysql.raw(`
        SELECT
               *,
               anope_db_NickAlias.id AS id,
               anope_db_NickCore.id AS accountId,
               levenshtein(anope_db_NickAlias.nick, :nickname) AS score
        FROM anope_db_NickAlias
                 LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        WHERE levenshtein(anope_db_NickAlias.nick, :nickname) <= :distance
        ORDER BY score
        LIMIT 10
    `, { nickname, distance })

    const emails = results.map((result) => {
      return result.email
    })

    const users = await User.findAll({
      where: {
        email: {
          like: { any: emails }
        }
      }
    })

    return results.map((result) => {
      const entry = new Nickname(result)
      entry.user = users.find((user) => {
        return user.email.toLowerCase() === entry.email.toLowerCase()
      })
      return entry
    })
  }

  /**
   *
   * @param {string} nickname Get a database nickname entry from a nickname string
   * @returns {Promise<Nickname>} a database nickname result
   */
  static async findNickname (nickname) {
    let [[account]] = await mysql.raw(`
        SELECT * FROM anope_db_NickAlias
        LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        WHERE
            lower(anope_db_NickAlias.nick) = lower(?)
    `, [nickname])
    if (!account) {
      return undefined
    }

    account = new Nickname(account)

    account.user = await User.findOne({
      where: {
        email: { ilike: account.email }
      }
    })
    return account
  }

  /**
   * Change the email of an Anope account
   * @param {string} currentEmail the current email
   * @param {string} newEmail the new email to set
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async setEmail (currentEmail, newEmail) {
    await mysql('anope_db_NickCore')
      .whereRaw('lower(email) = lower(?)', [currentEmail])
      .update({
        email: newEmail
      })
  }

  /**
   * Set the virtual host for all nicknames of an account
   * @param {string} email the email of the account to set a virtual host for
   * @param {string} vhost the virtual host to set
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async setVirtualHost (email, vhost) {
    await mysql.raw(`
        UPDATE anope_db_NickAlias
        LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        SET
            vhost_creator = 'API',
            vhost_time = UNIX_TIMESTAMP(),
            vhost_host = ?
        WHERE
            lower(anope_db_NickCore.email) = lower(?)
        `, [vhost, email])
  }

  /**
   * Set the password for an Anope account
   * @param {string} email the email of the account to set password for
   * @param {string} newPassword the password to set
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async setPassword (email, newPassword) {
    const encryptedPassword = await bcrypt.hash(newPassword, anopeBcryptRounds)

    await mysql('anope_db_NickCore')
      .whereRaw('lower(email) = lower(?)', [email])
      .update({
        password: `bcrypt:${encryptedPassword}`
      })
  }

  /**
   * Remove a nickname from the Anope database
   * @param {string} nickname the nickname to remove
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async removeNickname (nickname) {
    await mysql.raw(`
      DELETE FROM anope_db_NickAlias
      WHERE  lower(nick) = lower(?)
    `, [nickname])
  }

  /**
   * Add a new user to the Anope database
   * @param {string} email the email to use for the new user
   * @param {string} nick the main IRC nickname for the new user
   * @param {string} encryptedPassword a bcrypt encrypted password to use for the new user
   * @param {string} vhost vhoset to use for all nicknames of the new user
   * @returns {Promise<Nickname>} returns a newly created Nickname entry
   */
  static addNewUser (email, nick, encryptedPassword, vhost) {
    return mysql.transaction(async (transaction) => {
      const existingNickname = await Anope.findNickname(nick)
      if (existingNickname) {
        if (existingNickname.email.toLowerCase() === email.toLowerCase()) {
          return existingNickname
        } else {
          throw new ConflictAPIError({
            pointer: '/data/attributes/nickname'
          })
        }
      }

      const createdUnixTime = Math.floor(Date.getTime() / 1000)
      const user = await Anope.getAccount(email)
      if (!user) {
        await transaction.insert({
          AUTOOP: 1,
          HIDE_EMAIL: 1,
          HIDE_MASK: 1,
          MEMO_RECEIVE: 1,
          MEMO_SIGNON: 1,
          NS_PRIVATE: 1,
          NS_SECURE: 1,
          display: nick,
          email,
          memomax: 20,
          password: encryptedPassword
        }).into('anope_db_NickCore')
      }

      const insertedNickname = await transaction.insert({
        nc: nick,
        nick,
        time_registered: createdUnixTime,
        vhost_creator: 'API',
        vhost_time: createdUnixTime,
        vhost_host: vhost
      }).into('anope_db_NickAlias')

      await transaction.commit()
      return new Nickname(insertedNickname)
    })
  }
}

/**
 * An IRC Nickname database entry representation
 */
class Nickname {
  /**
   * Create a new Nickname object from a database result
   * @param {object} obj database object to use for creating the new result
   */
  constructor (obj) {
    this.id = obj.id
    this.lastQuit = obj.last_quit
    this.lastRealHost = obj.last_realhost
    this.lastRealName = obj.last_realname
    this.lastSeen = new Date(obj.last_seen * 1000)
    this.lastUserMask = obj.last_usermask
    this.display = obj.nc
    this.nick = obj.nick
    this.createdAt = new Date(obj.time_registered * 1000)
    this.updatedAt = parse(obj.timestamp)
    this.vhostSetBy = obj.vhost_creator
    this.vhost = obj.vhost_host
    this.vhostSetAt = new Date(obj.vhost_time * 1000)
    this.email = obj.email
    this.password = obj.pass
    this.fingerprint = obj.cert
    this.score = obj.score
  }
}
