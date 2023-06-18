import Model, { column, table, validate, type } from './Model'

/**
 * Model class for user sessions
 */
@table({
  indexes: [{
    fields: ['deviceToken', 'userId'],
  }],
})
export default class ApplePushSubscription extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.STRING, { unique: true })
  static deviceToken = undefined

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
    models.ApplePushSubscription.belongsTo(models.User, { as: 'user' })
  }
}
