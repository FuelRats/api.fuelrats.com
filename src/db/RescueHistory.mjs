import Model, { column, validate, type, table } from './Model'

/**
 * Model class for RescueHistory
 */
@table({ tableName: 'rescueshistory' })
export default class RescueHistory extends Model {
  /*  Override the ID field from rescues to not be set as a primary key,
  since the history contains multiple versions of the same rescue */
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.DATE, { primaryKey: true })
  static updatedAt = type.NOW

  @column(type.STRING)
  static client = undefined

  @column(type.STRING, { allowNull: true })
  static clientNick = undefined

  @column(type.STRING, { allowNull: true })
  static clientLanguage = undefined

  @column(type.INTEGER, { allowNull: true })
  static commandIdentifier = undefined

  @column(type.BOOLEAN)
  static codeRed = false

  @column(type.JSONB)
  static data = {}

  @column(type.TEXT)
  static notes = ''

  @column(type.ENUM('pc', 'xb', 'ps'), { allowNull: true })
  static platform = undefined

  @column(type.ARRAY(type.JSONB))
  static quotes = []

  @validate({ notEmpty: true, isIn: [['open', 'inactive', 'closed']] })
  @column(type.ENUM('open', 'inactive', 'closed'))
  static status = 'open'

  @column(type.STRING, { allowNull: true })
  static system = undefined

  @column(type.STRING, { allowNull: true })
  static title = undefined

  @column(type.ENUM(
    'success', 'failure', 'invalid', 'other', 'purge',
  ), { allowNull: true })
  static outcome = undefined

  @column(type.ARRAY(type.STRING))
  static unidentifiedRats = []

  @column(type.UUID, { allowNull: true })
  static firstLimpetId = undefined

  @column(type.UUID, { allowNull: true })
  static lastEditUserId = undefined

  @column(type.UUID, { allowNull: true })
  static lastEditClientId = undefined

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
