import Mail from '../classes/Mail'
import { Session, User, db } from '../db'
import crypto from 'crypto'
import { NotFoundAPIError } from '../classes/APIError'
import { Context } from '../classes/Context'
import API, {
  GET,
  parameters
} from './API'
import sessionEmail from '../emails/session'

const mail = new Mail()
const sessionTokenLength = 32

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
   * Verify a session token
   * @endpoint
   */
  @GET('/sessions/:token')
  @parameters('token')
  async verify (ctx) {
    const session = await Session.findOne({
      where: {
        code: ctx.params.token,
        verified: false
      }
    })

    if (!session) {
      throw new NotFoundAPIError({ parameter: 'token' })
    }

    await session.update({
      verified: true,
      lastAccess: Date.now()
    })

    return true
  }

  /**
   * Create a user session verification
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @returns {Promise<void>} completes a promise when email is sent
   */
  static async createSession (ctx, user) {
    const session = await Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      code: crypto.randomBytes(sessionTokenLength / 2).toString('hex'),
      userId: user.id
    })

    return mail.send(sessionEmail({ ctx, user, sessionToken: session.code }))
  }

  /**
   * Create a verified user session
   * @param {Context} ctx request context
   * @param {User} user the user the session belongs to
   * @param {db.Transaction} transaction Sequelize transaction
   * @returns {Session} user session
   */
  static createVerifiedSession (ctx, user, transaction = undefined) {
    return Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent,
      code: crypto.randomBytes(sessionTokenLength / 2).toString('hex'),
      userId: user.id,
      verified: true
    }, { transaction })
  }
}
