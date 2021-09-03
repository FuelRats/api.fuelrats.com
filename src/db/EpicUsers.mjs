import Model, { column, table, validate, type } from './Model'

/**
 * Model class for the epic nominees join table
 */
@table({})
export default class EpicUsers extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static epicId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.EpicUsers.belongsTo(models.Epic, { foreignKey: 'epicId' })
    models.EpicUsers.belongsTo(models.User, { foreignKey: 'userId' })
  }
}

