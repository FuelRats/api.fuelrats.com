import Model, { column, table, validate, type } from './Model'

@table({})
/**
 * Model class for assigned rats join table
 */
export default class RescueRats extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static rescueId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static ratId = undefined

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
    models.RescueRats.belongsTo(models.Rescue, { foreignKey: 'rescueId' })
    models.RescueRats.belongsTo(models.Rat, { foreignKey: 'ratId' })
    models.RescueRats.belongsTo(models.User, { as: 'assignerUser', foreignKey: 'assignerUserId' })
    models.RescueRats.belongsTo(models.Client, { as: 'assignerClient', foreignKey: 'assignerClientId' })
  }
}

