import {ShipName} from '../classes/Validators'


const MAX_INGAME_SHIP_NAME_LENGTH = 22
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
  'Vulture'
]

module.exports = function (sequelize, DataTypes) {
  let ship = sequelize.define('Ship', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    name: {
      type: DataTypes.CHAR(MAX_INGAME_SHIP_NAME_LENGTH),
      allowNull: false,
      validate: {
        is: ShipName
      }
    },
    shipId:  {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      autoIncrement: true,
      validate: {
        isInt: true,
        min: 1,
        max: 9999
      }
    },
    shipType: {
      type: DataTypes.ENUM(...shipTypes),
      validate: {
        notEmpty: true,
        isIn: shipTypes
      }
    },
    ratId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    }
  }, {
    paranoid: true
  })

  ship.associate = function (models) {
    models.Ship.belongsTo(models.Rat, { as: 'rat' })
  }

  return ship
}
