import {
  NotFoundAPIError,
  UnsupportedMediaAPIError,
} from './APIError'
import Permission from './Permission'
import StatusCode from './StatusCode'
import { Client, Token, User, db } from '../db'
import DatabaseDocument from '../Documents/DatabaseDocument'
import DatabaseQuery from '../query/DatabaseQuery'
import { TokenView } from '../view'
import {
  GET,
  DELETE,
  authenticated,
} from '../routes/API'
import APIResource from '../routes/APIResource'

/**
 * Session management endpoints — sessions are represented by Tokens
 * with associated device metadata (IP, user agent, last access, auth method).
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
    const searchObject = query.searchObject
    searchObject.where = { ...searchObject.where, userId: user.id }
    const rows = await db.query(
      `SELECT * FROM "Tokens" WHERE "userId" = :userId ORDER BY "createdAt" DESC LIMIT :limit OFFSET :offset`,
      {
        replacements: { userId: user.id, limit: searchObject.limit, offset: searchObject.offset },
        type: db.QueryTypes.SELECT,
        model: Token,
        mapToModel: true,
      },
    )
    // Load associated clients for each token
    const clientIds = [...new Set(rows.map((t) => t.clientId).filter(Boolean))]
    const clients = clientIds.length > 0
      ? await Client.findAll({ where: { id: clientIds } })
      : []
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))
    for (const token of rows) {
      token.client = clientMap[token.clientId] ?? null
    }
    const [{ count }] = await db.query(
      'SELECT COUNT(*) AS count FROM "Tokens" WHERE "userId" = :userId',
      { replacements: { userId: user.id }, type: db.QueryTypes.SELECT },
    )
    const result = { rows, count: parseInt(count, 10) }

    // Mark the token making this request
    const currentTokenValue = ctx.state.currentTokenValue
    for (const token of result.rows) {
      const isCurrent = Boolean(currentTokenValue && token.value === currentTokenValue)
      token.dataValues.current = isCurrent
    }

    return new DatabaseDocument({ query, result, type: TokenView })
  }

  /**
   * Revoke all sessions except the current one
   * @endpoint
   */
  @DELETE('/users/:id/sessions')
  @authenticated
  async revokeAll (ctx) {
    const user = await User.findOne({ where: { id: ctx.params.id } })
    if (!user) {
      throw new NotFoundAPIError({ parameter: 'id' })
    }
    this.requireWritePermission({ connection: ctx, entity: user })

    const currentTokenValue = ctx.state.currentTokenValue
    const where = { userId: user.id }
    if (currentTokenValue) {
      const { Op } = await import('sequelize')
      where.value = { [Op.ne]: currentTokenValue }
    }

    await Token.destroy({ where })
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
   * Revoke a session (destroy the token)
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

    const token = await Token.findOne({
      where: { id: ctx.params.sessionId, userId: user.id },
    })
    if (!token) {
      throw new NotFoundAPIError({ parameter: 'sessionId' })
    }

    await token.destroy()
    ctx.response.status = StatusCode.noContent
    return true
  }

  /**
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
}
