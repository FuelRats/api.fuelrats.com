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

function convert (obj) {
  return {
    id: obj.id,
    lastQuit: obj.last_quit,
    lastRealHost: obj.last_realhost,
    lastRealName: obj.last_realname,
    lastSeen: new Date(obj.last_seen * 1000),
    lastUserMask: obj.last_usermask,
    display: obj.nc,
    nick: obj.nick,
    createdAt: new Date(obj.time_registered * 1000),
    updatedAt: parse(obj.timestamp),
    vhostSetBy: obj.vhost_creator,
    vhost: obj.vhost_host,
    vhostSetAt: new Date(obj.vhost_time * 1000),
    email: obj.email,
    password: obj.pass,
    fingerprint: obj.cert,
    score: obj.score
  }
}

export default class Anope {
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

  static async setFingerprint (email, fingerprint) {
    return mysql.raw(`
        UPDATE anope_db_NickCore
        SET
            cert = ?
        WHERE
            lower(anope_db_NickCore.email) = lower(?)
        `, [fingerprint, email])
  }

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
        ORDER BY score ASC
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
      const entry = convert(result)
      entry.user = users.find((user) => {
        return user.email.toLowerCase() === entry.email.toLowerCase()
      })
      return entry
    })
  }

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

    account = convert(account)

    account.user = await User.findOne({
      where: {
        email: { ilike: account.email }
      }
    })
    return account
  }

  static setEmail (oldEmail, newEmail) {
    return mysql('anope_db_NickCore')
      .whereRaw('lower(email) = lower(?)', [oldEmail])
      .update({
        email: newEmail
      })
  }

  static setVirtualHost (email, vhost) {
    return mysql.raw(`
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

  static async setPassword (email, newPassword) {
    const encryptedPassword = await bcrypt.hash(newPassword, anopeBcryptRounds)

    return mysql('anope_db_NickCore')
      .whereRaw('lower(email) = lower(?)', [email])
      .update({
        password: `bcrypt:${encryptedPassword}`
      })
  }

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
      return insertedNickname
    })
  }
}
