import { JSONObject, validCMDRname } from '../classes/Validators'
import Model, { column, table, validate, type } from './Model'

@table({ paranoid: true })
export default class Rat extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isUUID: 4 }, { name: 'name' })
  @column(type.STRING, { name: 'name' })
  static ratName = undefined

  @validate({ JSONObject })
  @column(type.JSONB)
  static data = {}

  @column(type.DATE)
  static joined = type.NOW

  @column(type.ENUM('pc', 'xb', 'ps'))
  static platform = undefined

  @column(type.INTEGER, { allowNull: true })
  static frontierId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static userId = undefined

  static getScopes (models) {
    return {
      defaultScope: [{
        include: [{
          model: models.User.scope('norelations'),
          as: 'user',
          required: false
        }, {
          model: models.Ship,
          as: 'ships',
          required: false
        }]
      }, { override: true }],

      stats: [{}],

      rescues: [{
        include: [{
          model: models.User.scope('norelations'),
          as: 'user',
          required: false
        }, {
          model: models.Ship,
          as: 'ships',
          required: false
        }, {
          model: models.Rescue.scope(undefined),
          as: 'firstLimpet',
          required: false
        }, {
          model: models.Rescue.scope(undefined),
          as: 'rescues',
          required: false,
          through: {
            attributes: []
          }
        }]
      }]
    }
  }

  static associate (models) {
    super.associate(models)
    models.Rat.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    })

    models.Rat.belongsToMany(models.Rescue, {
      as: 'rescues',
      foreignKey: 'ratId',
      through: {
        model: models.RescueRats,
        foreignKey: 'ratId'
      }
    })

    models.Rat.hasMany(models.Rescue, { foreignKey: 'firstLimpetId', as: 'firstLimpet' })

    models.Rat.hasMany(models.Ship, {
      foreignKey: 'ratId',
      as: 'ships'
    })

    models.Rat.hasMany(models.Epic, { foreignKey: 'ratId', as: 'epics' })
  }
}
