import { FrontierRedeemCode } from '../helpers/Validators'
import Model, { column, table, validate, type } from './Model'

const decalNotesMaxLength = 4096

/**
 * Model class for decals
 */
@table({ paranoid: true })
export default class Decal extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ is: FrontierRedeemCode })
  @column(type.STRING)
  static code = undefined

  @column(type.ENUM('Rescues', 'Promotional', 'Special'))
  static type = undefined

  @column(type.DATE, { allowNull: true })
  static claimedAt = undefined

  @validate({ len: [0, decalNotesMaxLength] })
  @column(type.TEXT)
  static notes = ''

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static userId = undefined

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Decal.belongsTo(models.User, { as: 'user' })
  }
}
