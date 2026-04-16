import {
  NotFoundAPIError,
  UnsupportedMediaAPIError,
} from './APIError'
import Mail from './Mail'
import Permission from './Permission'
import StatusCode from './StatusCode'
import { sessionTokenGenerator } from './TokenGenerators'
import { Session, Token, User } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import sessionEmail from '../emails/session'
import DatabaseQuery from '../query/DatabaseQuery'
import { SessionView } from '../view'
import {
  GET,
  DELETE,
  authenticated,
  WritePermission,
} from '../routes/API'
import APIResource from '../routes/APIResource'

const mail = new Mail()

/**
 * Endpoint + helper class for managing user sessions
 */
export default class Sessions extends APIResource {
  /**
   * @returns {string} JSONAPI type
   */
  get type () {
    return 'sessions'
  }

  /**
   * List active sessions for a user
   * @endpoint
   */
  @GET('/users/:id/sessions')
  @authenticated
  async list (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireReadPermission({ connection: ctx, entity: user })

    const query = new DatabaseQuery({ connection: ctx })
    const result = await Session.findAndCountAll({
      where: { userId: user.id },
      ...query.searchObject,
    })

    // Mark the session tied to the token making this request
    const currentTokenValue = ctx.state.currentTokenValue
    if (currentTokenValue) {
      const currentToken = await Token.findOne({ where: { value: currentTokenValue } })
      if (currentToken?.sessionId) {
        for (const session of result.rows) {
          session.setDataValue('current', session.id === currentToken.sessionId)
        }
      }
    }

    return new DatabaseDocument({ query, result, type: SessionView })
  }

  /**
   * Revoke a session. Destroys the session and all tokens tied to it.
   * @endpoint
   */
  @DELETE('/users/:id/sessions/:sessionId')
  @authenticated
  async revoke (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const session = await Session.findOne({
      where: { id: ctx.params.sessionId, userId: user.id },
    })
    if (!session) {
      throw new NotFoundAPIError({ parameter: 'sessionId' })
    }

    // Revoke all tokens tied to this session, then the session itself
    await Token.destroy({ where: { sessionId: session.id } })
    await session.destroy()

    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Sessions use user-level permissions since they are a user sub-resource
   * @inheritdoc
   */
  hasReadPermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: ['users.read.me', 'users.read'], connection })
    }
    return Permission.granted({ permissions: ['users.read'], connection })
  }

  /**
   * @inheritdoc
   */
  hasWritePermission ({ connection, entity }) {
    if (this.isSelf({ ctx: connection, entity })) {
      return Permission.granted({ permissions: ['users.write.me'], connection })
        || Permission.granted({ permissions: ['users.write'], connection })
    }
    return Permission.granted({ permissions: ['users.write'], connection })
  }

  /**
   * @inheritdoc
   */
  isSelf ({ ctx, entity }) {
    return (entity.id && ctx.state.user.id === entity.id)
      || (entity.userId && ctx.state.user.id === entity.userId)
  }

  /**
   * @inheritdoc
   */
  get writePermissionsForFieldAccess () {
    return {}
  }

  /**
   * @inheritdoc
   */
  changeRelationship () {
    throw new UnsupportedMediaAPIError({ pointer: '/relationships' })
  }

  /**
   * @inheritdoc
   */
  get relationTypes () {
    return {}
  }

  /**
   * Create a session tied to a login event. Used during token issuance.
   * @param {object} arg function arguments object
   * @param {object} arg.ctx request context
   * @param {User} arg.user the user being authenticated
   * @returns {Promise<Session>} the created session
   */
  static async createForLogin ({ ctx, user }) {
    return Session.create({
      ip: ctx.request.ip,
      userAgent: ctx.state.userAgent || ctx.request.headers?.['user-agent'],
      fingerprint: ctx.state.fingerprint,
      userId: user.id,
      verified: true,
    })
  }

  /**
   * Create a user session verification (for device verification flow)
   * @param {object} ctx request context
   * @param {User} user the user the session belongs to
   * @returns {Promise<void>} completes when email is sent
   */
  static async createSession (ctx, user) {
    if (user.authenticator) {
      await Session.create({
        ip: ctx.request.ip,
        userAgent: ctx.state.userAgent,
        fingerprint: ctx.state.fingerprint,
        userId: user.id,
      })

      return undefined
    }

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
   * Create a verified user session (used by SSO/Frontier flows)
   * @param {object} ctx request context
   * @param {User} user the user the session belongs to
   * @param {object} transaction Sequelize transaction
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
