import { Session, User, db } from '../db'
import sessionEmail from '../emails/session'
import { Context } from './Context'
import Mail from './Mail'
import { sessionTokenGenerator } from './TokenGenerators'

const mail = new Mail()

/**
 * Class managing user session endpoints
 */
export default class Sessions {
  /**
   * Create a user session verification
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @returns {Promise<void>} completes a promise when email is sent
   */
  static async createSession (ctx, user) {
    const code = await sessionTokenGenerator()
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
    const code = await sessionTokenGenerator()

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
