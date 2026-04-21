import Model, { column, table, validate, type } from './Model'
import { JSONObject, CMDRname } from '../helpers/Validators'

/**
 * Model class for Rats
 */
@table({ paranoid: true })
export default class Rat extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** Commander name */
  @validate({ is: CMDRname }, { name: 'name' })
  @column(type.STRING, { name: 'name' })
  static ratName = undefined

  /** Arbitrary rat metadata */
  @validate({ JSONObject })
  @column(type.JSONB)
  static data = {}

  /** Gaming platform */
  @column(type.ENUM('pc', 'xb', 'ps'))
  static platform = undefined

  /** Game expansion version */
  @column(type.ENUM('horizons3', 'horizons4', 'odyssey'))
  static expansion = undefined

  /** Frontier Developments commander identifier */
  @column(type.INTEGER, { allowNull: true })
  static frontierId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static userId = undefined

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        include: [{
          model: models.User.scope('norelations'),
          as: 'user',
          required: false,
        }],
      }, { override: true }],

      stats: [{}],

      rescues: [{
        include: [{
          model: models.User.scope('norelations'),
          as: 'user',
          required: false,
        }, {
          model: models.Rescue.scope(undefined),
          as: 'firstLimpet',
          required: false,
        }, {
          model: models.Rescue.scope(undefined),
          as: 'rescues',
          required: false,
          through: {
            attributes: [],
          },
        }],
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Rat.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId',
    })

    models.Rat.belongsToMany(models.Rescue, {
      as: 'rescues',
      foreignKey: 'ratId',
      through: {
        model: models.RescueRats,
        foreignKey: 'ratId',
      },
    })

    models.Rat.hasMany(models.Rescue, { foreignKey: 'firstLimpetId', as: 'firstLimpet' })
  }
}
