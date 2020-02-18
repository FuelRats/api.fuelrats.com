import { column, validate, type, table } from './Model'
import RescueRats from './RescueRats'

@table({ tableName: 'rescueratshistory' })
export default class RescueRatsHistory extends RescueRats {
  /*  Override the ID field from rescues to not be set as a primary key,
  since the history contains multiple versions of the same rescue */
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.DATE, { primaryKey: true })
  static updatedAt = type.NOW

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
