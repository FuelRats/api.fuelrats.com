import Model, { column, table, validate, type } from './Model'
import { FrontierRedeemCode } from '../helpers/Validators'

const decalNotesMaxLength = 4096

/**
 * Model class for decals
 */
@table({ paranoid: true })
export default class Decal extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** Frontier store redemption code */
  @validate({ is: FrontierRedeemCode })
  @column(type.STRING)
  static code = undefined

  /** Decal award category */
  @column(type.ENUM('Rescues', 'Promotional', 'Special'))
  static type = undefined

  /** Date the decal was claimed by a user */
  @column(type.DATE, { allowNull: true })
  static claimedAt = undefined

  /** Administrative notes about this decal */
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
