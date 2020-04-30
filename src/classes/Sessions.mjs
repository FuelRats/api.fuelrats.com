import { customAlphabet } from 'nanoid/async'
import { Context } from '../classes/Context'
import Mail from '../classes/Mail'
import { Session, User, db } from '../db'
import sessionEmail from '../emails/session'
import API from './API'

const mail = new Mail()
const sessionTokenLength = 6
const generateToken = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', sessionTokenLength)

/**
 * Class managing user session endpoints
 */
export default class Sessions extends API {
  /**
   * @inheritdoc
   */
  get type () {
    return 'sessions'
  }

  /**
   * Create a user session verification
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @returns {Promise<void>} completes a promise when email is sent
   */
  static async createSession (ctx, user) {
    const code = await generateToken()
    const session = await Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      fingerprint: ctx.state.fingerprint,
      code,
      userId: user.id,
    })

    return mail.send(sessionEmail({ ctx, user, sessionToken: session.code }))
  }

  /**
   * Create a verified user session
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @param {db.Transaction} transaction Sequelize transaction
   * @returns {Promise<Session>} user session
   */
  static async createVerifiedSession (ctx, user, transaction = undefined) {
    const code = await generateToken()

    return Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      fingerprint: ctx.state.fingerprint,
      code,
      userId: user.id,
      verified: true,
    }, { transaction })
  }
}
