import Model, { column, table, validate, type } from './Model'

/**
 * Model class for rescue dispatcher assignments
 */
@table({})
export default class RescueDispatchers extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static rescueId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  @column(type.UUID, { allowNull: true })
  static assignerUserId = undefined

  @column(type.UUID, { allowNull: true })
  static assignerClientId = undefined

  @column(type.RANGE(type.DATE))
  static temporalPeriod = [type.now, undefined]

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.RescueDispatchers.belongsTo(models.Rescue, { foreignKey: 'rescueId' })
    models.RescueDispatchers.belongsTo(models.User, { foreignKey: 'userId' })
    models.RescueDispatchers.belongsTo(models.User, { as: 'assignerUser', foreignKey: 'assignerUserId' })
    models.RescueDispatchers.belongsTo(models.Client, { as: 'assignerClient', foreignKey: 'assignerClientId' })
  }
}
