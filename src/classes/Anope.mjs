import bcrypt from 'bcrypt'
import knex from 'knex'
import UUID from 'pure-uuid'
import config from '../config'
import { User, Rat } from '../db'
import { ConflictAPIError, NotFoundAPIError } from './APIError'

const { database, username, hostname, port } = config.anope
const anopeBcryptRounds = 10
const defaultMaximumEditDistance = 5


const mysql = knex({
  client: 'mysql',
  connection: {
    host: hostname,
    port,
    user: username,
    database,
  },
  pool: {
    afterCreate (conn, done) {
      conn.query('ALTER TABLE anope_db_NickAlias ADD COLUMN IF NOT EXISTS rat_id BINARY(16);', (err) => {
        done(err, conn)
      })
    },
  },
})


/**
 * @classdesc Class managing the interface to Anope
 * @class
 */
class Anope {
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

    let users = []

    if (results.length > 0) {
      users = await User.findAll({
        where: {
          email: {
            like: { any: emails },
          },
        },
      })
    }

    return results.map((result) => {
      const entry = new Nickname(result)
      entry.user = users.find((user) => {
        return user.email.toLowerCase() === entry.email.toLowerCase()
      })
      return entry
    })
  }

  /**
   * Map nicknames onto a user object
   * @param {User} user object to map onto
   * @returns {Promise<User>} user object with mapped nicknames
   */
  static async mapNickname (user) {
    const ircUser = user

    const [results] = await mysql.raw(`
        SELECT *
        FROM anope_db_NickAlias
        LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        WHERE lower(email) = lower(:email)
    `, {
      email: user.email,
    })

    // noinspection JSUndefinedPropertyAssignment
    ircUser.nicknames = results.map((result) => {
      return new Nickname(result, user)
    })

    return ircUser
  }

  /**
   * Map nicknames onto a list of user objects
   * @param {[User] }users list of users to map onto
   * @returns {Promise<[User]>} list of user objects with mapped nicknames
   */
  static async mapNicknames (users) {
    const ircUsers = users
    if (users.rows.length === 0) {
      return users
    }

    const userEmails = users.rows.map((user) => {
      return user.email.toLowerCase()
    })

    const [results] = await mysql.raw(`
        SELECT *
        FROM anope_db_NickAlias
        LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        WHERE lower(email) IN (:emails)
    `, {
      emails: userEmails,
    })

    ircUsers.rows = users.rows.map((user) => {
      ircUsers.nicknames = results.reduce((nicknames, result) => {
        if (result.email.toLowerCase() === user.email.toLowerCase()) {
          const nickname = new Nickname(result, user)
          nicknames.push(nickname)
        }
        return nicknames
      }, [])

      return user
    })

    return ircUsers
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
        email: { iLike: account.email },
      },
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
        email: newEmail,
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
   * Update IRC permissions for a user
   * @param {User} user the user to update permissions for
   * @returns {Promise<void>} resolves a promise when completed
   */
  static async updatePermissions (user) {
    await Anope.setVirtualHost(user.email, user.vhost())

    const channels = user.flags()
    if (!channels) {
      return undefined
    }

    const permissionChanges = Object.entries(channels).reduce((promises, [channel, flags]) => {
      promises.push(Anope.setFlags({ channel, user, flags }))
      promises.push(Anope.setInvite({ channel, user }))
      return promises
    }, [])

    return Promise.all(permissionChanges)
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
        pass: `bcrypt:${encryptedPassword}`,
      })
  }

  /**
   * Remove a nickname from the Anope database
   * @param {string} nickname the nickname to remove
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static removeNickname (nickname) {
    return mysql.raw(`
      DELETE FROM anope_db_NickAlias
      WHERE  lower(nick) = lower(?)
    `, [nickname])
  }

  /**
   * Delete an Anope account
   * @param {string} email the email belonging to the account you wish to delete
   * @returns {Promise<undefined>} Promise is void on completion
   */
  static async deleteAccount (email) {
    await mysql.raw(`
        DELETE anope_db_NickAlias.* FROM anope_db_NickAlias
        LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        WHERE
            lower(anope_db_NickCore.email) = lower(:email)
            
    `, { email })

    return mysql.raw(`
        DELETE FROM anope_db_NickCore
        WHERE
            lower(anope_db_NickCore.email) = lower(:email)
    `, { email })
  }

  /**
   * Add a new user to the Anope database
   * @param {object} arg function arguments object
   * @param {string} arg.email the email to use for the new user
   * @param {string} arg.nick the main IRC nickname for the new user
   * @param {string} arg.encryptedPassword a bcrypt encrypted password to use for the new user
   * @param {string} arg.vhost vhost to use for all nicknames of the new user
   * @param {string} [arg.ratId] the id of an optional Rat to bind to this nickname
   * @returns {Promise<Nickname>} returns a newly created Nickname entry
   */
  static addNewUser ({
    email, nick, encryptedPassword, vhost, ratId,
  }) {
    return mysql.transaction(async (transaction) => {
      if (ratId) {
        const rat = await Rat.findOne({
          where: {
            id: ratId,
          },
        })

        if (!rat) {
          throw new NotFoundAPIError({
            pointer: '/data/attributes/ratId',
          })
        }
      }

      const existingNickname = await Anope.findNickname(nick)
      if (existingNickname) {
        if (existingNickname.email.toLowerCase() === email.toLowerCase()) {
          return existingNickname
        }
        throw new ConflictAPIError({
          pointer: '/data/attributes/nickname',
        })
      }

      const createdUnixTime = Math.floor(Date.now() / 1000)
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
          pass: encryptedPassword,
        }).into('anope_db_NickCore')
      }

      const accountNick = user ? user.display : nick

      const insertedNickname = await transaction.insert({
        nc: accountNick,
        nick,
        time_registered: createdUnixTime,
        vhost_creator: 'API',
        vhost_time: createdUnixTime,
        vhost_host: vhost,
        rat_id: ratId,
      }).into('anope_db_NickAlias')

      await transaction.commit()
      return new Nickname(insertedNickname)
    })
  }

  /**
   * Get a channel flags entry for a user
   * @param {object} arg function arguments object
   * @param {string} arg.channel channel to get flags for
   * @param {User} arg.user user to get flags for
   * @returns {knex.Raw<*>} Knex query
   */
  static getFlags ({ channel, user }) {
    return mysql.raw(`
        SELECT anope_db_ChanAccess.*
        FROM anope_db_ChanAccess
        LEFT JOIN anope_db_NickCore ON lower(email) = lower(:email)
        WHERE
          lower(anope_db_ChanAccess.ci) = lower(:channel) AND
          anope_db_ChanAccess.mask = anope_db_NickCore.display
    `, { channel, email: user.email })
  }

  /**
   * Create a new channel permission entry for a user
   * @param {object} arg function arguments object
   * @param {string} arg.channel channel to set flags for
   * @param {User} arg.user user to set flags for
   * @param {[string]} arg.flags flags to set
   * @returns {knex.Raw<*>} knex query
   */
  static insertFlags ({ channel, user, flags }) {
    return mysql.raw(`
      INSERT INTO anope_db_ChanAccess (timestamp, ci, created, creator, data, last_seen, mask, provider)
      SELECT
          CURRENT_TIMESTAMP AS timestamp,
          :channel AS ci,
          UNIX_TIMESTAMP() AS created,
          'API' as creator,
          :flags AS data,
          anope_db_NickAlias.last_seen AS last_seen,
          anope_db_NickCore.display AS mask,
          'access/flags' AS provider
      FROM anope_db_NickCore
      INNER JOIN anope_db_NickAlias ON anope_db_NickAlias.nc = anope_db_NickCore.display
      WHERE
          lower(email) = lower(:email)
      LIMIT 1
    `, { channel, email: user.email, flags: flags.join('') })
  }

  /**
   * Update an existing permission entry for a user in a channel
   * @param {object} arg function arguments object
   * @param {string} arg.channel channel to set flags for
   * @param {User} arg.user user to set flags for
   * @param {[string]} arg.flags flags to set
   * @returns {knex.Raw<*>} knex query
   */
  static updateFlags ({ channel, user, flags }) {
    return mysql.raw(`
        UPDATE anope_db_ChanAccess
        LEFT JOIN anope_db_NickCore ON lower(email) = lower(:email)
        SET
            anope_db_ChanAccess.creator = 'API',
            anope_db_ChanAccess.timestamp = CURRENT_TIMESTAMP,
            anope_db_ChanAccess.data = :flags
        WHERE
            lower(anope_db_ChanAccess.ci) = lower(:channel) AND
            anope_db_ChanAccess.mask = anope_db_NickCore.display
      `, { channel, email: user.email, flags: flags.join('') })
  }

  /**
   * Set the permission flags for a user in a channel
   * @param {object} arg function arguments object
   * @param {string} arg.channel channel to set flags for
   * @param {User} arg.user user to set flags for
   * @param {[string]} arg.flags flags to set
   * @returns {Promise<void>} resolves a promise when successful
   */
  static async setFlags ({ channel, user, flags }) {
    const [flagsEntry] = await Anope.getFlags({ channel, user })

    if (flagsEntry && flagsEntry.length > 0) {
      await Anope.updateFlags({ channel, user, flags })
    } else {
      await Anope.insertFlags({ channel, user, flags })
    }
  }

  /**
   * Set an invite for a user on a channel
   * @param {object} arg function arguments object
   * @param {string} arg.channel the IRC channel to set invite in
   * @param {User} arg.user the user to set an invite for
   * @returns {Promise<knex.Raw<*>>} Knex query
   */
  static setInvite ({ channel, user }) {
    return mysql.raw(`
    INSERT INTO anope_db_ModeLock (timestamp, ci, created, name, param, \`set\`, setter)
    SELECT
        CURRENT_TIMESTAMP,
        :channel,
        UNIX_TIMESTAMP(),
        'INVITEOVERRIDE',
        CONCAT('~a:', anope_db_NickCore.display),
        1,
        'API'
    FROM anope_db_NickCore
    WHERE
        lower(anope_db_NickCore.email) = lower(:email) AND
        NOT EXISTS(
            SELECT 1 FROM anope_db_ModeLock WHERE
                ci = :channel AND
                name = 'INVITEOVERRIDE' AND
                param = CONCAT('~a:', anope_db_NickCore.display)
        )
    `, { channel, email: user.email })
  }
}

/**
 * An IRC Nickname database entry representation
 */
class Nickname {
  /**
   * Create a new Nickname object from a database result
   * @param {object} obj database object to use for creating the new result
   * @param {object} user the user that this Nickname belongs to
   */
  constructor (obj, user = undefined) {
    this.id = new UUID(5, 'ns:URL', `https://api.fuelrats.com/nicknames/${obj.id}`)
    this.lastQuit = obj.last_quit
    this.lastRealHost = obj.last_realhost
    this.lastRealName = obj.last_realname
    this.lastSeen = new Date(obj.last_seen * 1000)
    this.lastUserMask = obj.last_usermask
    this.display = obj.nc
    this.nick = obj.nick
    this.createdAt = new Date(obj.time_registered * 1000)
    this.updatedAt = obj.timestamp
    this.vhostSetBy = obj.vhost_creator
    this.vhost = obj.vhost_host
    this.vhostSetAt = new Date(obj.vhost_time * 1000)
    this.email = obj.email
    this.password = obj.pass
    this.fingerprint = obj.cert
    this.score = obj.score
    this.ratId = obj.rat_id

    this.user = user
    this.rat = undefined
  }
}

export default Anope
