import Model, { column, table, validate, type } from './Model'

/**
 * Model class for the IRC groupsync outbox.
 *
 * A durable, at-least-once delivery queue for `NickServ GROUPSYNC <email>`
 * push-triggers (Phase C). A row is enqueued whenever a user's channel access
 * may have changed; the outbox worker delivers it to Anope and marks it
 * `delivered` only once the module acknowledges the modes were applied.
 *
 * The partial unique index on `email` (pending rows only) coalesces bursts:
 * repeated changes to the same user while a delivery is still pending collapse
 * onto the single outstanding row instead of piling up.
 */
@table({
  indexes: [
    {
      name: 'irc_outbox_pending_email',
      unique: true,
      fields: ['email'],
      where: { status: 'pending' },
    },
    { fields: ['status', 'nextRetryAt'] },
  ],
})
export default class IrcOutbox extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** Account email to resync (the groupsync identity key) */
  @validate({ isEmail: true })
  @column(type.STRING, { allowNull: false })
  static email = undefined

  /** Delivery state: awaiting delivery, applied by Anope, or dead-lettered */
  @column(type.ENUM('pending', 'delivered', 'failed'))
  static status = 'pending'

  /** Number of delivery attempts made so far */
  @validate({ isInt: true })
  @column(type.INTEGER, { allowNull: false })
  static attempts = 0

  /** Earliest time the worker may (re)attempt delivery */
  @validate({ isDate: true })
  @column(type.DATE, { allowNull: true })
  static nextRetryAt = undefined

  /** Last delivery error, retained on the dead-lettered row for diagnosis */
  @column(type.TEXT, { allowNull: true })
  static lastError = undefined
}
