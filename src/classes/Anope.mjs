import { hashPassword } from '../helpers/password'
import knex from 'knex'
import config from '../config'
import { User, Rat, IrcOutbox } from '../db'
import logger from '../logging'
import {
  APIError, ForbiddenAPIError, UnauthorizedAPIError, UnprocessableEntityAPIError, ConflictAPIError, NotFoundAPIError,
} from './APIError'

const {
  database,
  username,
  hostname,
  port,
  password,
  tablePrefix,
} = config.anope
const anopeBcryptRounds = 10
const nickUpdateWait = 5000
// const defaultMaximumEditDistance = 5

// Injection hardening (Risk 37): values interpolated into a services command
// string sent over JSON-RPC must not carry whitespace/control characters, which
// Anope's command tokenizer would split into extra arguments (or, via a newline,
// smuggle a second command). These patterns reject anything with an embedded
// space, tab, newline, or other separator before it can reach `runCommand`.
const EMAIL_MAX_LENGTH = 254
const SAFE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const SAFE_IRC_CHANNEL_PATTERN = /^#[^\s,]{1,64}$/u
const SAFE_IRC_NICK_PATTERN = /^[^\s,]{1,64}$/u

/**
 * Assert an email is safe to interpolate into a services command.
 * @param {*} email candidate email
 * @returns {string} the email, if safe
 * @throws {UnprocessableEntityAPIError} when the value is unsafe
 */
function assertSafeEmail (email) {
  if (typeof email !== 'string'
    || email.length === 0
    || email.length > EMAIL_MAX_LENGTH
    || !SAFE_EMAIL_PATTERN.test(email)) {
    throw new UnprocessableEntityAPIError({ parameter: 'email' })
  }
  return email
}

// Anope SQL table names. The prefix differs between Anope 2.0 (`anope_db_`) and
// Anope 2.1 (`anope21_`) and is set via FRAPI_ANOPE_TABLE_PREFIX. Anope 2.1 also
// links a NickAlias to its NickCore by the numeric `ncid` (= NickCore.uniqueid)
// rather than the 2.0 string join (NickCore.display = NickAlias.nc), and stores
// certificate fingerprints in a dedicated NSCert table.
const NICK_CORE = `${tablePrefix}NickCore`
const NICK_ALIAS = `${tablePrefix}NickAlias`
const CHAN_ACCESS = `${tablePrefix}ChanAccess`
const CHANNEL_INFO = `${tablePrefix}ChannelInfo`
const MODE_LOCK = `${tablePrefix}ModeLock`
const NS_CERT = `${tablePrefix}NSCert`

// Extra SELECT columns for the nickname joins: the alias's OWN registration time
// aliased to avoid the `SELECT *` collision with NickCore.registered (which would
// otherwise win and give the account's registration, not the nick's), plus the
// account's certificate fingerprint (moved to the NSCert table in 2.1).
const NICK_EXTRA_SELECT = `${NICK_ALIAS}.registered AS nick_registered, (SELECT fingerprint FROM ${NS_CERT} WHERE account = ${NICK_CORE}.uniqueid LIMIT 1) AS cert`


const mysql = knex({
  client: 'mysql',
  connection: {
    host: hostname,
    port,
    user: username,
    database,
    password,
    // Anope's account key (NickCore.uniqueid = NickAlias.ncid) is a BIGINT that
    // exceeds JS's safe integer range; return big numbers as strings so the value
    // (and the account link derived from it) is not silently truncated.
    supportBigNumbers: true,
    bigNumberStrings: true,
  },
  pool: {
    afterCreate (conn, done) {
      conn.query(`ALTER TABLE ${NICK_ALIAS} ADD COLUMN IF NOT EXISTS rat_id BINARY(16);`, (err) => {
        done(err, conn)
      })
    },
  },
})


/**
 * Generate an Anope account uniqueid: a large positive integer stored as a
 * string, used as the NickCore.uniqueid and the NickAlias.ncid link key.
 * @returns {string} a uniqueid value
 */
function generateUniqueId () {
  const high = Math.floor(Math.random() * 0x7fffffff)
  const low = Math.floor(Math.random() * 0xffffffff)
  return ((BigInt(high) << 32n) | BigInt(low)).toString()
}


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
    if (!config.anope.database) {
      return undefined
    }
    const results = await mysql.select('*')
      .from(NICK_CORE)
      .leftJoin(NICK_ALIAS, `${NICK_CORE}.uniqueid`, `${NICK_ALIAS}.ncid`)
      .whereRaw('lower(email) = lower(?)', [email])

    if (results.length > 0) {
      return results[0]
    }
    return undefined
  }

  /**
   * List every channel registered with ChanServ, ordered by name. Backs the
   * group-management channel-access autocomplete and the bot's registered-channel
   * guard, so access can only be granted to channels that actually exist.
   * @returns {Promise<string[]>} registered channel names (e.g. `#fuelrats`); empty when Anope is unconfigured
   */
  static async getRegisteredChannels () {
    if (!config.anope.database) {
      return []
    }
    const results = await mysql.select('name')
      .from(CHANNEL_INFO)
      .orderBy('name')
    return results.map((row) => {
      return row.name
    })
  }

  /**
   * Run an Anope services command via the Anope 2.1 JSON-RPC interface.
   * @param {string} service the anope service to command (e.g NickServ)
   * @param {string} user the user to act as when calling the command
   * @param {string} command the command to run
   * @returns {Promise<*>} a promise that resolves with the result of the command
   */
  static async runCommand (service, user, command) {
    if (!config.anope.jsonrpc) {
      throw new Error('Anope JSON-RPC not configured')
    }

    const headers = { 'Content-Type': 'application/json' }
    if (config.anope.jsonrpcToken) {
      // Anope's JSON-RPC expects `Bearer <base64(token)>` and base64-decodes it
      // server-side before comparing to the configured token.
      headers.Authorization = `Bearer ${Buffer.from(config.anope.jsonrpcToken).toString('base64')}`
    }

    const response = await fetch(config.anope.jsonrpc, {
      method: 'POST',
      headers,
      // anope.command takes [account, service, command] — note the account/service
      // order is reversed from the removed XML-RPC `command` method.
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'anope.command',
        params: [user, service, command],
        id: 1,
      }),
    })

    const data = await response.json()
    const processed = processAnopeResponse(data.error ?? data.result ?? {})
    if (processed instanceof APIError) {
      throw processed
    }
    return processed
  }

  /**
   * Sync the state of an IRC channel
   * @param {string} channel the irc channel
   * @returns {Promise<*>} a promise that resolves with the result of the command
   */
  static syncChannel (channel) {
    if (!SAFE_IRC_CHANNEL_PATTERN.test(channel)) {
      throw new UnprocessableEntityAPIError({ parameter: 'channel' })
    }
    return Anope.runCommand('ChanServ', 'xlexious', `SYNC ${channel}`)
  }

  /**
   * Update the IRC state
   * @param {any} user the user to update the state of
   */
  static async updateIRCState (user) {
    if (!config.anope.jsonrpc) {
      return
    }

    const results = await mysql.select('*')
      .from(NICK_CORE)
      .leftJoin(NICK_ALIAS, `${NICK_CORE}.uniqueid`, `${NICK_ALIAS}.ncid`)
      .whereRaw('lower(email) = lower(?)', [user.email])

    if (results.length === 0) {
      return
    }

    const nicks = results.map((result) => {
      return new Nickname(result, user)
    })


    for (const nick of nicks) {
      // nick.nick originates from the Anope DB, but validate defensively before
      // it is interpolated into the command string (Risk 37).
      if (!SAFE_IRC_NICK_PATTERN.test(nick.nick ?? '')) {
        continue
      }
      await Anope.runCommand('NickServ', nick.nick, 'UPDATE')
    }
  }

  /**
   * Push a channel-role resync for an account to the groupsync module.
   *
   * Fires the module's oper-only `NickServ GROUPSYNC <email>` command over
   * JSON-RPC, impersonating the configured services-oper actor. The module
   * fetches the account's roles from the API and reapplies channel modes
   * synchronously, replying with a machine-parseable acknowledgement. This
   * resolves only once that ack confirms the resync was *applied* (Risk 48) —
   * a bare transport success is not treated as delivered.
   * @param {string} email the account email to resync
   * @returns {Promise<{applied: boolean, response: string}>} the delivery result
   */
  static async groupSync (email) {
    if (!config.anope.jsonrpc) {
      throw new Error('Anope JSON-RPC not configured')
    }

    assertSafeEmail(email)

    const result = await Anope.runCommand('NickServ', config.anope.groupsyncActor, `GROUPSYNC ${email}`)
    const response = typeof result === 'string' ? result : JSON.stringify(result ?? {})
    return { applied: /\bapplied\b/iu.test(response), response }
  }

  /**
   * Enqueue a durable, coalesced groupsync push for an account.
   *
   * Writes a pending row to the IRC outbox; the outbox worker delivers it with
   * retry/backoff. The partial unique index collapses repeated changes to the
   * same account onto the single outstanding row. Never throws into the request
   * handler — a failure to enqueue is logged, not surfaced.
   * @param {string} email the account email to resync
   * @returns {Promise<undefined>} resolves once the row is enqueued (or skipped)
   */
  static async enqueueGroupSync (email) {
    if (!config.anope.jsonrpc) {
      return undefined
    }

    let normalized
    try {
      normalized = assertSafeEmail(email).toLowerCase()
    } catch {
      logger.warn('Refusing to enqueue groupsync for an invalid email')
      return undefined
    }

    try {
      await IrcOutbox.findOrCreate({
        where: { email: normalized, status: 'pending' },
        defaults: {
          email: normalized,
          status: 'pending',
          attempts: 0,
          nextRetryAt: new Date(),
        },
      })
    } catch (error) {
      logger.error({ message: 'Failed to enqueue groupsync', error })
    }
    return undefined
  }

  /**
   *
   * @param {string} email the email of the account to set the fingerprint of
   * @param {string} fingerprint the fingerprint to set
   * @returns {Promise<undefined>} resolves a promise when completed
   */
  static async setFingerprint (email, fingerprint) {
    if (!config.anope.database) {
      return undefined
    }

    const account = await mysql(NICK_CORE)
      .whereRaw('lower(email) = lower(?)', [email])
      .first('uniqueid')

    if (!account) {
      return undefined
    }

    // 2.1 stores certificates in NSCert. Mirror the previous single-cert `SET`
    // behaviour: clear the account's existing cert(s) and set the new one.
    await mysql(NS_CERT).where({ account: account.uniqueid }).del()

    if (fingerprint) {
      await mysql(NS_CERT).insert({
        fingerprint,
        account: account.uniqueid,
        created: Math.floor(Date.now() / 1000),
        creator: 'API',
      })
    }

    return undefined
  }

  /**
   * Get a list of accounts matching an exact nickname
   * @param {string} nickname the nickname to search by
   * @returns {Promise<[Nickname]>} a list of nick search results
   */
  static async findAccountsByNickname (nickname) {
    if (!config.anope.database) {
      return []
    }
    const [results] = await mysql.raw(`
        SELECT
               *,
               ${NICK_ALIAS}.id AS id,
               ${NICK_CORE}.id AS accountId,
               ${NICK_EXTRA_SELECT}
        FROM ${NICK_ALIAS}
                 LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
        WHERE ${NICK_ALIAS}.nick = :nickname
        LIMIT 10
    `, { nickname })

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
   * Search accounts with a case-insensitive LIKE match on nickname
   * @param {string} pattern the LIKE pattern to search by (e.g. "%partial%")
   * @returns {Promise<[Nickname]>} a list of nick search results
   */
  static async searchAccountsByNickname (pattern) {
    if (!config.anope.database) {
      return []
    }
    const [results] = await mysql.raw(`
        SELECT
               *,
               ${NICK_ALIAS}.id AS id,
               ${NICK_CORE}.id AS accountId,
               ${NICK_EXTRA_SELECT}
        FROM ${NICK_ALIAS}
                 LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
        WHERE LOWER(${NICK_ALIAS}.nick) LIKE LOWER(:pattern)
        LIMIT 10
    `, { pattern })

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
    if (!config.anope.database) {
      return user
    }
    const ircUser = user

    const [results] = await mysql.raw(`
        SELECT
            *,
            ${NICK_ALIAS}.id AS id,
            ${NICK_CORE}.id AS accountId,
            ${NICK_EXTRA_SELECT}
        FROM ${NICK_ALIAS}
        LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
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
    if (!config.anope.database) {
      return users
    }

    const ircUsers = users
    if (users.rows.length === 0) {
      return users
    }

    const userEmails = users.rows.map((user) => {
      return user.email.toLowerCase()
    })

    const [results] = await mysql.raw(`
        SELECT
            *,
            ${NICK_ALIAS}.id AS id,
            ${NICK_CORE}.id AS accountId,
            ${NICK_EXTRA_SELECT}
        FROM ${NICK_ALIAS}
        LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
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
   * @param {string} id Get a database nickname entry from a nickname id
   * @returns {Promise<Nickname>} a database nickname result
   */
  static async findId (id) {
    if (!config.anope.database) {
      return undefined
    }

    const anopeId = uuidToInt(id)

    let [[account]] = await mysql.raw(`
        SELECT
            *,
            ${NICK_ALIAS}.id AS id,
            ${NICK_CORE}.id AS accountId,
            ${NICK_EXTRA_SELECT}
        FROM ${NICK_ALIAS}
        LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
        WHERE
            lower(${NICK_ALIAS}.id) = ?
    `, [anopeId])
    if (!account) {
      return undefined
    }

    account = new Nickname(account)

    account.user = await User.findOne({
      where: {
        email: { iLike: account.email },
        status: 'active',
      },
    })
    return account
  }

  /**
   *
   * @param {string} nickname Get a database nickname entry from a nickname string
   * @returns {Promise<Nickname>} a database nickname result
   */
  static async findNickname (nickname) {
    if (!config.anope.database) {
      return undefined
    }

    let [[account]] = await mysql.raw(`
        SELECT
            *,
            ${NICK_ALIAS}.id AS id,
            ${NICK_CORE}.id AS accountId,
            ${NICK_EXTRA_SELECT}
        FROM ${NICK_ALIAS}
        LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
        WHERE
            lower(${NICK_ALIAS}.nick) = lower(?)
        ORDER BY ${NICK_CORE}.id IS NULL
        LIMIT 1
    `, [nickname])
    if (!account) {
      return undefined
    }

    account = new Nickname(account)

    account.user = await User.findOne({
      where: {
        email: { iLike: account.email },
        status: 'active',
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
    if (!config.anope.database) {
      return
    }

    await mysql(NICK_CORE)
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
    if (!config.anope.database) {
      return
    }

    await mysql.raw(`
        UPDATE ${NICK_ALIAS}
        LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
        SET
            vhost_creator = 'API',
            vhost_time = UNIX_TIMESTAMP(),
            vhost_host = ?
        WHERE
            lower(${NICK_CORE}.email) = lower(?)
        `, [vhost, email])
  }

  /**
   * Update the virtual host (and nickname IRC state) for a user.
   *
   * Vhost is HostServ-managed and is never owned by the groupsync module, so
   * this path stays regardless of the channel-access source of truth. Called on
   * vhost-affecting events (rat/display-rat changes) and as part of a full
   * permission update.
   * @param {User} user the user to update the vhost for
   * @returns {Promise<void>} resolves a promise when completed
   */
  static async updateVhost (user) {
    if (!config.anope.database) {
      return undefined
    }

    try {
      await Anope.setVirtualHost(user.email, user.vhost())

      setTimeout(() => {
        Anope.updateIRCState(user)
      }, nickUpdateWait)
    } catch {
      logger.error('Failed to update vhost for user', user)
    }
    return undefined
  }

  /**
   * Update IRC permissions for a user: the vhost plus, while the legacy path is
   * enabled, the direct channel-access flag writes.
   *
   * The channel-flag writes are gated behind `FRAPI_ANOPE_LEGACY_CHANNEL_WRITES`
   * so they can be retired once the groupsync module is the sole source of truth
   * for channel access; the vhost update always runs.
   * @param {User} user the user to update permissions for
   * @returns {Promise<void>} resolves a promise when completed
   */
  static async updatePermissions (user) {
    if (!config.anope.database) {
      return undefined
    }

    await Anope.updateVhost(user)

    if (!config.anope.legacyChannelWrites) {
      return undefined
    }

    try {
      const channels = user.flags()
      if (!channels) {
        return undefined
      }

      for (const [channel, flags] of Object.entries(channels)) {
        await Anope.setFlags({ channel, user, flags })
        await Anope.setInvite({ channel, user })
      }

      for (const channel of Object.keys(channels)) {
        await Anope.syncChannel(channel)
      }
    } catch {
      logger.error('Failed to update channel permissions for user', user)
    }
    return undefined
  }

  /**
   * Remove all permissions related to a group for a user
   * @param {any} user the user object to remove permissions for
   * @param {any} group the group to remove permissions for
   * @returns {Promise<undefined>} resolves a promise when completed
   */
  static removeChannelPermissions (user, group) {
    if (!config.anope.database || !config.anope.legacyChannelWrites) {
      return undefined
    }

    if (!group || Object.keys(group.channels).length === 0) {
      return undefined
    }

    const permissionChanges = Object.keys(group.channels).map((channel) => {
      return Anope.removeFlags({ channel, user })
    })
    return Promise.all(permissionChanges)
  }

  /**
   * Audit the API-created channel-access footprint ahead of the groupsync
   * cutover purge (Risk 42). Read-only.
   *
   * Reports the creator breakdown (so a human can confirm `API` is not also used
   * by people), the API-owned `ChanAccess` rows split by active vs soft-deleted
   * (`timestamp IS NULL`), a sample, and the API-set `INVITEOVERRIDE` mode-locks.
   * @returns {Promise<object|null>} the audit, or null when Anope DB is unconfigured
   */
  static async auditApiChannelAccess () {
    if (!config.anope.database) {
      return null
    }

    const byCreator = await mysql(CHAN_ACCESS)
      .select('creator')
      .count({ count: '*' })
      .groupBy('creator')

    const [active] = await mysql(CHAN_ACCESS)
      .where({ creator: 'API' })
      .whereNotNull('timestamp')
      .count({ count: '*' })

    const [softDeleted] = await mysql(CHAN_ACCESS)
      .where({ creator: 'API' })
      .whereNull('timestamp')
      .count({ count: '*' })

    const sample = await mysql(CHAN_ACCESS)
      .where({ creator: 'API' })
      .select('ci', 'mask', 'data', 'provider', 'timestamp')
      .limit(10)

    const [inviteModeLocks] = await mysql(MODE_LOCK)
      .where({ setter: 'API', name: 'INVITEOVERRIDE' })
      .count({ count: '*' })

    return {
      byCreator,
      apiActive: Number(active?.count ?? 0),
      apiSoftDeleted: Number(softDeleted?.count ?? 0),
      inviteModeLocks: Number(inviteModeLocks?.count ?? 0),
      sample,
    }
  }

  /**
   * Purge the API-created channel-access rows once groupsync is the source of
   * truth (Phase G). Dry-run by default — pass `execute: true` to delete.
   *
   * Only rows stamped `creator = 'API'` are removed (human-created access is
   * left untouched); soft-deleted API rows are included. `INVITEOVERRIDE`
   * mode-locks set by the API are only removed when `includeModeLocks` is set.
   * @param {object} [arg] options
   * @param {boolean} [arg.execute] actually delete (default false = dry-run)
   * @param {boolean} [arg.includeModeLocks] also delete API `INVITEOVERRIDE` mode-locks
   * @returns {Promise<object|null>} the audit (dry-run) or deletion counts (execute)
   */
  static async purgeApiChannelAccess ({ execute = false, includeModeLocks = false } = {}) {
    if (!config.anope.database) {
      return null
    }

    const audit = await Anope.auditApiChannelAccess()
    if (!execute) {
      return { dryRun: true, ...audit }
    }

    const deletedAccess = await mysql(CHAN_ACCESS).where({ creator: 'API' }).del()

    let deletedModeLocks = 0
    if (includeModeLocks) {
      deletedModeLocks = await mysql(MODE_LOCK)
        .where({ setter: 'API', name: 'INVITEOVERRIDE' })
        .del()
    }

    return { dryRun: false, deletedAccess, deletedModeLocks }
  }

  /**
   * Set the password for an Anope account
   * @param {string} email the email of the account to set password for
   * @param {string} newPassword the password to set
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async setPassword (email, newPassword) {
    if (!config.anope.database) {
      return
    }

    const encryptedPassword = await hashPassword(newPassword, anopeBcryptRounds)

    await mysql(NICK_CORE)
      .whereRaw('lower(email) = lower(?)', [email])
      .update({
        pass: `bcrypt:${encryptedPassword}`,
      })
  }

  /**
   * Set the display nickname for an Anope account
   * @param {string} email the email of the account
   * @param {string} displayNick the nickname to set as display
   * @returns {Promise<object>} resolves with the result from NickServ
   */
  static async setDisplayNickname (email, displayNick) {
    if (!config.anope.database) {
      throw new Error('Anope database not configured')
    }

    // First verify the nickname exists and belongs to the user
    const nickname = await this.findNickname(displayNick)
    if (!nickname) {
      throw new NotFoundAPIError({ parameter: 'displayNick' })
    }

    if (nickname.email.toLowerCase() !== email.toLowerCase()) {
      throw new ForbiddenAPIError({ parameter: 'displayNick' })
    }

    // Use NickServ SET DISPLAY command to change the display nickname
    const result = await this.runCommand('NickServ', displayNick, `SET DISPLAY ${displayNick}`)

    return result
  }

  /**
   * Get the memo mail preference for an Anope account
   * @param {string} email the user's email
   * @returns {Promise<boolean>} whether memo mail is enabled
   */
  static async getMemoMail (email) {
    if (!config.anope.database) {
      return false
    }

    try {
      const result = await mysql.select('MEMO_MAIL')
        .from(NICK_CORE)
        .whereRaw('lower(email) = lower(?)', [email])
        .first()

      return result?.MEMO_MAIL === '1'
    } catch {
      return false
    }
  }

  /**
   * Set the memo mail preference for an Anope account
   * @param {string} email the user's email
   * @param {boolean} enabled whether to enable memo mail
   * @returns {Promise<undefined>} resolves when completed
   */
  static async setMemoMail (email, enabled) {
    if (!config.anope.database) {
      return
    }

    await mysql(NICK_CORE)
      .whereRaw('lower(email) = lower(?)', [email])
      .update({ MEMO_MAIL: enabled ? '1' : null })
  }

  /**
   * Remove a nickname from the Anope database
   * @param {string} nickname the nickname to remove
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async removeNickname (nickname) {
    if (!config.anope.database) {
      return undefined
    }

    const alias = await mysql(NICK_ALIAS)
      .whereRaw('lower(nick) = lower(?)', [nickname])
      .first('ncid')

    await mysql.raw(`
      DELETE FROM ${NICK_ALIAS}
      WHERE  lower(nick) = lower(?)
    `, [nickname])

    // If that was the group's last alias, remove the now-orphaned account so it can't
    // resurface as a nick with no listable aliases (and no whois-resolvable account).
    if (alias?.ncid) {
      const remaining = await mysql(NICK_ALIAS)
        .where({ ncid: alias.ncid })
        .count({ count: '*' })
        .first()

      if (Number(remaining?.count ?? 0) === 0) {
        await mysql(NICK_CORE).where({ uniqueid: alias.ncid }).del()
      }
    }

    return undefined
  }

  /**
   * Remove a nickname from the Anope database by its Anope alias id
   * @param {number} anopeId the Anope NickAlias id to remove
   * @returns {Promise<undefined>} resolves a promise when completed successfully
   */
  static async removeNicknameByAnopeId (anopeId) {
    if (!config.anope.database) {
      return undefined
    }

    await mysql(NICK_ALIAS).where({ id: anopeId }).del()
    return undefined
  }

  /**
   * Delete an Anope account
   * @param {string} email the email belonging to the account you wish to delete
   * @returns {Promise<undefined>} Promise is void on completion
   */
  static async deleteAccount (email) {
    if (!config.anope.database) {
      return undefined
    }

    await mysql.raw(`
        DELETE ${NICK_ALIAS}.* FROM ${NICK_ALIAS}
        LEFT JOIN ${NICK_CORE} ON ${NICK_CORE}.uniqueid = ${NICK_ALIAS}.ncid
        WHERE
            lower(${NICK_CORE}.email) = lower(:email)

    `, { email })

    return mysql.raw(`
        DELETE FROM ${NICK_CORE}
        WHERE
            lower(${NICK_CORE}.email) = lower(:email)
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
    if (!config.anope.database) {
      return undefined
    }

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
        if (existingNickname.email?.toLowerCase() === email.toLowerCase()) {
          return existingNickname
        }
        throw new ConflictAPIError({
          pointer: '/data/attributes/nickname',
        })
      }

      const createdUnixTime = Math.floor(Date.now() / 1000)
      const user = await Anope.getAccount(email)

      // Anope 2.1 links a NickAlias to its account by ncid = NickCore.uniqueid.
      // Reuse the account's uniqueid when it already exists, otherwise mint one
      // for the freshly created NickCore.
      let accountUniqueId
      if (user) {
        accountUniqueId = user.uniqueid
      } else {
        accountUniqueId = generateUniqueId()
        await transaction.insert({
          AUTOLOGIN: 1,
          AUTOOP: 1,
          HIDE_EMAIL: 1,
          HIDE_MASK: 1,
          PROTECT: 1,
          MEMO_RECEIVE: 1,
          MEMO_SIGNON: 1,
          NS_PRIVATE: 1,
          display: nick,
          email,
          memomax: 20,
          pass: encryptedPassword,
          uniqueid: accountUniqueId,
          registered: createdUnixTime,
        }).into(NICK_CORE)
      }

      const insertedNickname = await transaction.insert({
        ncid: accountUniqueId,
        nick,
        registered: createdUnixTime,
        vhost_creator: 'API',
        vhost_time: createdUnixTime,
        vhost_host: vhost,
        NS_NO_EXPIRE: 1,
      }).into(NICK_ALIAS)

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
        SELECT ${CHAN_ACCESS}.*
        FROM ${CHAN_ACCESS}
        LEFT JOIN ${NICK_CORE} ON lower(email) = lower(:email)
        WHERE
          lower(${CHAN_ACCESS}.ci) = lower(:channel) AND
          ${CHAN_ACCESS}.mask = ${NICK_CORE}.display
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
      INSERT INTO ${CHAN_ACCESS} (timestamp, ci, created, creator, data, last_seen, mask, provider)
      SELECT
          CURRENT_TIMESTAMP AS timestamp,
          :channel AS ci,
          UNIX_TIMESTAMP() AS created,
          'API' as creator,
          :flags AS data,
          ${NICK_ALIAS}.last_seen AS last_seen,
          ${NICK_CORE}.display AS mask,
          'access/flags' AS provider
      FROM ${NICK_CORE}
      INNER JOIN ${NICK_ALIAS} ON ${NICK_ALIAS}.ncid = ${NICK_CORE}.uniqueid
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
        UPDATE ${CHAN_ACCESS}
        LEFT JOIN ${NICK_CORE} ON lower(email) = lower(:email)
        SET
            ${CHAN_ACCESS}.creator = 'API',
            ${CHAN_ACCESS}.timestamp = CURRENT_TIMESTAMP,
            ${CHAN_ACCESS}.data = :flags
        WHERE
            lower(${CHAN_ACCESS}.ci) = lower(:channel) AND
            ${CHAN_ACCESS}.mask = ${NICK_CORE}.display
      `, { channel, email: user.email, flags: flags.join('') })
  }

  /**
   * @param {object} arg function arguments object
   * @param {string} arg.channel channel to set flags for
   * @param {User} arg.user user to set flags for}
   */
  static async removeFlags ({ channel, user }) {
    const account = await Anope.getAccount(user.email)
    if (!account) {
      return
    }

    await mysql.raw(`
        UPDATE ${CHAN_ACCESS}
        LEFT JOIN ${NICK_CORE} ON lower(email) = lower(:email)
        SET
            ${CHAN_ACCESS}.timestamp = NULL
        WHERE
            lower(${CHAN_ACCESS}.ci) = lower(:channel) AND
            ${CHAN_ACCESS}.mask = ${NICK_CORE}.display

`, { channel, email: user.email })
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
    INSERT INTO ${MODE_LOCK} (timestamp, ci, created, name, param, \`set\`, setter)
    SELECT
        CURRENT_TIMESTAMP,
        :channel,
        UNIX_TIMESTAMP(),
        'INVITEOVERRIDE',
        CONCAT('~a:', ${NICK_CORE}.display),
        1,
        'API'
    FROM ${NICK_CORE}
    WHERE
        lower(${NICK_CORE}.email) = lower(:email) AND
        NOT EXISTS(
            SELECT 1 FROM ${MODE_LOCK} WHERE
                ci = :channel AND
                name = 'INVITEOVERRIDE' AND
                param = CONCAT('~a:', ${NICK_CORE}.display)
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
    this.id = intToUuid(obj.id)
    this.anopeId = obj.id
    this.lastQuit = obj.last_quit
    this.lastRealHost = obj.last_userhost_real
    // Anope 2.1 dropped the realname column; emit null (not undefined) so the
    // attribute key is still serialised for API consumers that require it.
    this.lastRealName = obj.last_realname ?? null
    this.lastSeen = new Date(obj.last_seen * 1000)
    this.lastUserMask = obj.last_userhost
    this.display = obj.display
    this.nick = obj.nick
    this.createdAt = new Date(obj.nick_registered * 1000)
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

const base16 = 16
const uuidPadding = 12
const uuidComponents = 4

/**
 * Convert a UUIDv4 string to an Integer
 * @param {string} stringUuid a UUIDv4 stirng
 * @returns {number} an integer derived from the UUID string
 */
function uuidToInt (stringUuid) {
  const uuid = BigInt(`0x${stringUuid.split('-')[uuidComponents]}`)
  return Number(uuid)
}

/**
 * Convert an integer to a UUIDv4 string
 * @param {number} number a number to convert to a UUIDv4 string
 * @returns {string} a UUIDv4 string derived from the number
 */
function intToUuid (number) {
  const bigInt = BigInt(number)
  return `00000000-0000-4000-0000-${bigInt.toString(base16).padStart(uuidPadding, 0)}`
}


const responseTranslations = {
  'isn\'t registered': new NotFoundAPIError({ pointer: '/data/attributes/nickname' }),
  'Password authentication required': new UnauthorizedAPIError({ pointer: '/data/attributes/password' }),
  'more obscure password': new UnprocessableEntityAPIError({ pointer: '/data/attributes/password' }),
  'password is too long': new UnprocessableEntityAPIError({ pointer: '/data/attributes/password' }),
  'may not be registered': new UnprocessableEntityAPIError({ pointer: '/data/attributes/nickname' }),
  'is already registered': new ConflictAPIError({ pointer: '/data/attributes/nickname' }),
  'may not drop other Services Operator': new ForbiddenAPIError({ pointer: '/data/attributes/nickname' }),
  'Invalid parameters': new UnprocessableEntityAPIError({}),
}

/**
 * Process an Anope response into a useable result
 * @param {any} result an unprocessed Anope response (JSON-RPC result or error)
 * @returns {*} a processed result or an APIError
 */
function processAnopeResponse (result) {
  const haystack = typeof result === 'string' ? result : JSON.stringify(result ?? {})
  const [, translation] = Object.entries(responseTranslations).find(([key]) => {
    return new RegExp(key, 'giu').test(haystack)
  }) ?? []
  return translation ?? result
}

export default Anope
