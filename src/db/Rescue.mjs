import Model, { column, validate, type, table } from './Model'
import { JSONObject, RescueQuote } from '../helpers/Validators'

const rescueNotesMaxLength = 2048
const rescueSystemMaxLength = 64
const rescueTitleMaxLength = 64

/**
 * Model class for Rescues
 */
@table({
  paranoid: true,
  indexes: [{
    fields: ['data'],
    using: 'gin',
    operator: 'jsonb_path_ops',
  }],
})
export default class Rescue extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** Client commander name */
  @validate({ notEmpty: true })
  @column(type.STRING)
  static client = undefined

  /** Client IRC nickname */
  @validate({ notEmpty: true })
  @column(type.STRING, { allowNull: true })
  static clientNick = undefined

  /** Client preferred language */
  @column(type.STRING, { allowNull: true })
  static clientLanguage = undefined

  /** Rescue case number */
  @validate({ isInt: true, min: 0 })
  @column(type.INTEGER, { allowNull: true })
  static commandIdentifier = undefined

  /** Whether this is a code red (emergency, client on fumes) */
  @column(type.BOOLEAN)
  static codeRed = false

  /** Whether the client was rescued by fleet carrier */
  @column(type.BOOLEAN)
  static carrier = false

  /** Additional rescue metadata */
  @validate({ JSONObject })
  @column(type.JSONB)
  static data = {}

  /** Rescue notes and paperwork */
  @validate({ len: [0, rescueNotesMaxLength] })
  @column(type.TEXT)
  static notes = ''

  /** Gaming platform */
  @column(type.ENUM('pc', 'xb', 'ps'), { allowNull: true })
  static platform = undefined

  /** Game expansion */
  @column(type.ENUM('horizons3', 'horizons4', 'odyssey'), { allowNull: true })
  static expansion = undefined

  /** Rescue chat quotes */
  @validate({ RescueQuote })
  @column(type.ARRAY(type.JSONB))
  static quotes = []

  /** Rescue status */
  @validate({ notEmpty: true, isIn: [['open', 'inactive', 'queued', 'closed']] })
  @column(type.ENUM('open', 'inactive', 'queued', 'closed'))
  static status = 'open'

  /** Star system location */
  @validate({ len: [1, rescueSystemMaxLength], isUppercase: true })
  @column(type.STRING, { allowNull: true })
  static system = undefined

  /** Rescue title */
  @validate({ len: [1, rescueTitleMaxLength] })
  @column(type.STRING, { allowNull: true })
  static title = undefined

  /** Rescue outcome */
  @validate({ notEmpty: true, isIn: [['success', 'failure', 'invalid', 'other', 'purge']] })
  @column(type.ENUM(
    'success', 'failure', 'invalid', 'other', 'purge',
  ), { allowNull: true })
  static outcome = undefined

  /** Unidentified commanders involved in this rescue */
  @column(type.ARRAY(type.STRING))
  static unidentifiedRats = []

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static firstLimpetId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static lastEditUserId = undefined

  @column(type.UUID, { allowNull: true })
  static lastEditClientId = undefined

  @column(type.RANGE(type.DATE))
  static temporalPeriod = [type.now, undefined]

  /**
   * @inheritdoc
   */
  static getScopes (model) {
    return {
      defaultScope: [{
        include: [
          {
            model: model.Rat,
            as: 'rats',
            required: false,
            through: {
              attributes: [],
            },
          },
          {
            model: model.Rat,
            as: 'firstLimpet',
            required: false,
          },
          {
            model: model.Epic,
            as: 'epics',
            required: false,
          },
          {
            model: model.User.scope('public'),
            as: 'lastEditUser',
            required: false,
          },
          {
            model: model.User.scope('public'),
            as: 'dispatchers',
            required: false,
            through: {
              attributes: [],
            },
          },
        ],
      }, {
        override: true,
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Rescue.belongsTo(models.Rat, {
      as: 'firstLimpet',
      foreignKey: 'firstLimpetId',
    })

    models.Rescue.belongsToMany(models.Rat, {
      as: 'rats',
      foreignKey: 'rescueId',
      through: {
        model: models.RescueRats,
        foreignKey: 'rescueId',
      },
    })

    models.Rescue.belongsTo(models.User, {
      as: 'lastEditUser',
      foreignKey: 'lastEditUserId',
    })

    models.Rescue.belongsTo(models.Client, {
      as: 'lastEditClient',
      foreignKey: 'lastEditClientId',
    })

    models.Rescue.hasMany(models.Epic, { foreignKey: 'rescueId', as: 'epics' })

    models.Rescue.belongsToMany(models.User, {
      as: 'dispatchers',
      foreignKey: 'rescueId',
      otherKey: 'userId',
      through: {
        model: models.RescueDispatchers,
      },
    })
  }

  /**
   * @param {Context} ctx
   */
  setChangelogDetails (ctx) {
    this.set('lastEditUserId', ctx.state.user.id)
    this.set('lastEditClientId', ctx.state.clientId)
    this.set('updatedAt', new Date())
    this.changed('updatedAt', true)
  }
}
