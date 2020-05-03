import Model, { column, table, validate, type } from './Model'

const sessionTokenLength = 6

@table({
  indexes: [{
    fields: ['ip', 'userAgent', 'code'],
  }],
})
/**
 * Model class for user sessions
 */
export default class Session extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.INET)
  static ip = undefined

  @column(type.STRING)
  static userAgent = undefined

  @column(type.STRING)
  static fingerprint = undefined

  @column(type.DATE)
  static lastAccess = type.NOW

  @column(type.BOOLEAN)
  static verified = false

  @validate({ isUppercase: true })
  @column(type.STRING(sessionTokenLength))
  static code = undefined

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
    models.Session.belongsTo(models.User, { as: 'user' })
  }
}
