import Model, { column, table, validate, type } from './Model'

/**
 * Model class for user sessions
 */
@table({})
export default class Authenticator extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** User-assigned label for this TOTP authenticator */
  @column(type.STRING)
  static description = undefined

  /** TOTP shared secret */
  @column(type.STRING)
  static secret = undefined

  /** One-time backup codes for account recovery */
  @column(type.ARRAY(type.STRING), { defaultValue: [] })
  static recoveryCodes = []

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
            required: false,
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
    models.Authenticator.belongsTo(models.User, { as: 'user' })
  }
}
