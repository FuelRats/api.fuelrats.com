import knex from 'knex'
import config from '../../config'
import bcrypt from 'bcrypt'

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
  static nicknamesForEmail (email) {
    return mysql.select('*')
      .from('anope_db_NickCore')
      .leftJoin('anope_db_NickAlias', 'anope_db_NickCore.display', 'anope_db_NickAlias.nc')
      .whereRaw('lower(email) = lower(?)', [email])
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
      const createdUnixTime = Math.floor(Date.getTime() / 1000)

      const insertedUser = await transaction.insert({
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

      const insertedAlias = await transaction.insert({
        nc: nick,
        nick,
        time_registered: createdUnixTime,
        vhost_creator: 'API',
        vhost_time: createdUnixTime,
        vhost_host: vhost
      }).into('anope_db_NickAlias')

      await transaction.commit()

      insertedUser.nicknames = [insertedAlias]
      return insertedUser
    })
  }
}
