import Model, { column, table, validate, type } from './Model'

const resetPasswordTokenLength = 32

@table({})
/**
 * Model class for password resets
 */
export default class Reset extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isAlphanumeric: true, len: [resetPasswordTokenLength, resetPasswordTokenLength] })
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
    models.Reset.belongsTo(models.User, { as: 'user' })
  }
}
