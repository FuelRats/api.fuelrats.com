import Model, { column, table, validate, type } from './Model'

const verificationTokenLength = 32


/**
 * Model class for account verification tokens
 */
@table({})
export default class VerificationToken extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isAlphanumeric: true, len: [verificationTokenLength, verificationTokenLength] })
  @column(type.STRING)
  static value = undefined

  @validate({ isDate: true })
  @column(type.DATE)
  static expires = undefined

  @column(type.BOOLEAN)
  static required = false

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.VerificationToken.belongsTo(models.User, { as: 'user' })
  }
}
