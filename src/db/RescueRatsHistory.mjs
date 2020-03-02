import Model, { column, validate, type, table } from './Model'

@table({ tableName: 'rescueratshistory' })
export default class RescueRatsHistory extends Model {
  /*  Override the ID field from rescues to not be set as a primary key,
  since the history contains multiple versions of the same rescue */
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.DATE, { primaryKey: true })
  static updatedAt = type.NOW

  @column(type.UUID)
  static rescueId = undefined

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
  static getScopes () {
    return {}
  }

  /**
   * @inheritdoc
   */
  // eslint-disable-next-line no-empty-function
  static associate () {

  }
}
