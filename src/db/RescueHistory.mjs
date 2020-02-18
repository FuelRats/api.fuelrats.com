import { column, validate, type, table } from './Model'
import Rescue from './Rescue'

@table({ tableName: 'rescueshistory' })
export default class RescueHistory extends Rescue {
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
  // eslint-disable-next-line no-empty-function
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
