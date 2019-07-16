import knex from 'knex'
import config from '../../config'
import bcrypt from 'bcrypt'
import { ConflictAPIError } from './APIError'

const { database, username, password, hostname, port } = config.anope
const anopeBcryptRounds = 10

const mysql = knex({
  client: 'mysql',
  connection: {
    host: hostname,
    port,
    user: username,
    database
  }
})

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

  static async findNickname (nickname) {
    const nicknames = await mysql.raw(`
        SELECT * FROM anope_db_NickAlias
        LEFT JOIN anope_db_NickCore ON anope_db_NickCore.display = anope_db_NickAlias.nc
        WHERE
            lower(anope_db_NickAlias.nick) = lower('?')
    `, [nickname])
    if (nicknames.length > 0) {
      return nicknames[0]
    }
    return undefined
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
