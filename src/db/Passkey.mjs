import Model, { column, table, validate, type } from './Model'

/**
 * Model class for WebAuthn/Passkey credentials
 */
@table({})
export default class Passkey extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.STRING)
  static credentialId = undefined

  @column(type.TEXT)
  static publicKey = undefined

  @column(type.INTEGER)
  static counter = 0

  @column(type.STRING)
  static name = undefined

  @column(type.BOOLEAN)
  static backedUp = false

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
    models.Passkey.belongsTo(models.User, { as: 'user' })
  }
}
