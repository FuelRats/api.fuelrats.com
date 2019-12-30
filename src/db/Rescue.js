/* eslint-disable */

import { IRCNickname, JSONObject, languageCode, RescueQuote } from '../classes/Validators'
import Model, { column, validate, type, table } from './Model'

/* eslint max-lines-per-function:0 */

// eslint-disable-next-line
const rescueClientNameMaxLength = 64
const rescueNotesMaxLength = 2048
const rescueSystemMaxLength = 64
const rescueTitleMaxLength = 64

@table({ paranoid: true, indexes: [{
    fields: ['data'],
    using: 'gin',
    operator: 'jsonb_path_ops'
  }]
})
export default class Rescue extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ notEmpty: true })
  @column(type.STRING)
  static client = undefined

  @validate({ is: [IRCNickname, 'i'] })
  @column(type.STRING, { allowNull: true })
  static clientNick = undefined

  @validate({ is: [languageCode, ''] })
  @column(type.STRING, { allowNull: true })
  static clientLanguage = undefined

  @validate({ isInt: true, min: 0 })
  @column(type.INTEGER, { allowNull: true })
  static commandIdentifier = undefined

  @column(type.BOOLEAN, { allowNull: true })
  static codeRed = false

  @validate({ JSONObject })
  @column(type.JSONB)
  static data = {}

  @validate({ len: [0, rescueNotesMaxLength] })
  @column(type.TEXT)
  static notes = ''

  @column(type.ENUM('pc', 'xb', 'ps'), { allowNull: true })
  static platform = undefined

  @validate({ RescueQuote })
  @column(type.ARRAY(type.JSONB))
  static quotes = []

  @validate({ notEmpty: true, isIn: [['open', 'inactive', 'closed']] })
  @column(type.ENUM('open', 'inactive', 'closed'))
  static status = 'open'

  @validate({ len: [1, rescueSystemMaxLength], isUppercase: true })
  @column(type.STRING, { allowNull: true })
  static system = undefined

  @validate({ len: [1, rescueTitleMaxLength],isAlphanumeric: true })
  @column(type.STRING, { allowNull: true })
  static title = undefined

  @validate({ notEmpty: true, isIn: [['success', 'failure', 'invalid', 'other', 'purge']] })
  @column(type.ENUM('success', 'failure', 'invalid', 'other', 'purge'), { allowNull: true })
  static outcome = undefined

  @column(type.ARRAY(type.STRING))
  static unidentifiedRats = []

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static firstLimpetId = undefined

  static getScopes (model) {
    return {
      defaultScope: [{
        include: [
          {
            model: model.Rat,
            as: 'rats',
            required: false,
            through: {
              attributes: []
            }
          },
          {
            model: model.Rat,
            as: 'firstLimpet',
            required: false
          },
          {
            model: model.Epic,
            as: 'epics',
            required: false
          }
        ]
      }, {
        override: true
      }]
    }
  }

  static associate (models) {
    super.associate(models)
    models.Rescue.belongsTo(models.Rat, {
      as: 'firstLimpet',
      foreignKey: 'firstLimpetId'
    })

    models.Rescue.belongsToMany(models.Rat, {
      as: 'rats',
      foreignKey: 'rescueId',
      through: {
        model: models.RescueRats,
        foreignKey: 'rescueId'
      }
    })

    models.Rescue.hasMany(models.Epic, { foreignKey: 'rescueId', as: 'epics' })
  }
}
