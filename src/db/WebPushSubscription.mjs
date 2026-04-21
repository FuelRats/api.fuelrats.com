import Model, { column, table, validate, type } from './Model'

/**
 * Model class for user sessions
 */
@table({
  indexes: [{
    fields: ['endpoint', 'userId'],
  }],
})
export default class WebPushSubscription extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** Push subscription endpoint URL */
  @column(type.STRING, { unique: true })
  static endpoint = undefined

  /** Subscription expiry time */
  @column(type.INTEGER, { allowNull: true })
  static expirationTime = undefined

  /** Push subscription auth key */
  @column(type.STRING)
  static auth = undefined

  /** Push subscription P-256 public key */
  @column(type.STRING)
  static p256dh = undefined

  /** Only receive explicit alert notifications */
  @column(type.BOOLEAN)
  static alertsOnly = true

  /** Subscribe to PC rescue notifications */
  @column(type.BOOLEAN)
  static pc = true

  /** Subscribe to Xbox rescue notifications */
  @column(type.BOOLEAN)
  static xb = true

  /** Subscribe to PlayStation rescue notifications */
  @column(type.BOOLEAN)
  static ps = true

  /** Subscribe to Horizons 3.8 rescue notifications */
  @column(type.BOOLEAN)
  static horizons3 = true

  /** Subscribe to Horizons 4.0 rescue notifications */
  @column(type.BOOLEAN)
  static horizons4 = true

  /** Subscribe to Odyssey rescue notifications */
  @column(type.BOOLEAN)
  static odyssey = true

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        include: [
          {
            model: models.User.scope('norelations'),
            as: 'user',
            required: true,
          },
        ],
      }, {
        override: true,
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.WebPushSubscription.belongsTo(models.User, { as: 'user' })
  }
}
