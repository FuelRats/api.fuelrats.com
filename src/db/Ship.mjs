import Model, { column, table, validate, type } from './Model'
import { ShipName } from '../helpers/Validators'


const maxIngameShipNameLength = 22
const shipTypes = [
  'Adder',
  'Anaconda',
  'Asp Explorer',
  'Asp Scout',
  'Beluga Liner',
  'Cobra MkIII',
  'Cobra MkIV',
  'Diamondback Explorer',
  'Diamondback Scout',
  'Dolphin',
  'Eagle',
  'F63 Condor',
  'Federal Assault Ship',
  'Federal Corvette',
  'Federal Dropship',
  'Federal Gunship',
  'Fer-de-lance',
  'Hauler',
  'Imperial Clipper',
  'Imperial Courier',
  'Imperial Cutter',
  'Imperial Eagle',
  'Imperial Fighter',
  'Keelback',
  'Orca',
  'Python',
  'Sidewinder MkI',
  'Taipan Fighter',
  'Type-6 Transporter',
  'Type-7 Transporter',
  'Type-9 Heavy',
  'Viper MkIII',
  'Viper MkIV',
  'Vulture',
]

/**
 * Model class for rat ships
 */
@table({})
export default class Ship extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ is: ShipName }, { name: 'name' })
  @column(type.STRING(maxIngameShipNameLength), { name: 'name' })
  static shipName = undefined

  @validate({ isInt: true, min: 1, max: 9999 })
  @column(type.INTEGER, { unique: true })
  static shipId = undefined

  @column(type.ENUM(...shipTypes))
  static shipType = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static ratId = undefined

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Ship.belongsTo(models.Rat, { as: 'rat' })
  }
}
