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

  @column(type.STRING, { unique: true })
  static endpoint = undefined

  @column(type.INTEGER, { allowNull: true })
  static expirationTime = undefined

  @column(type.STRING)
  static auth = undefined

  @column(type.STRING)
  static p256dh = undefined

  @column(type.BOOLEAN)
  static alertsOnly = true

  @column(type.BOOLEAN)
  static pc = true

  @column(type.BOOLEAN)
  static xb = true

  @column(type.BOOLEAN)
  static ps = true

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
            model: models.User,
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
