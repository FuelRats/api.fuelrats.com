'use strict'

const MAX_INGAME_SHIP_NAME_LENGTH = 22

module.exports = function (sequelize, DataTypes) {
  let Ship = sequelize.define('Ship', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.CHAR(MAX_INGAME_SHIP_NAME_LENGTH),
      allowNull: false
    },
    shipId:  {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      autoIncrement: true
    },
    shipType: {
      type: DataTypes.ENUM(
        'Adder',
        'Alliance Crusader',
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
        'Mamba',
        'Orca',
        'Python',
        'Sidewinder MkI',
        'Taipan Fighter',
        'Type-6 Transporter',
        'Type-7 Transporter',
        'Type-9 Heavy',
        'Type-10 Defender',
        'Viper MkIII',
        'Viper MkIV',
        'Vulture'
      )
    }
  }, {
    paranoid: true
  })

  Ship.associate = function (models) {
    models.Ship.belongsTo(models.Rat, { as: 'rat' })
  }

  return Ship
}
