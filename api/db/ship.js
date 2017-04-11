'use strict'

module.exports = function (sequelize, DataTypes) {
  let Ship = sequelize.define('Ship', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.CHAR(22),
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
        'Type 9 Heavy',
        'Viper MkIII',
        'Viper MkIV',
        'Vulture'
      )
    }
  }, {
    paranoid: true,
    classMethods: {
      associate: function (models) {
        Ship.belongsTo(models.Rat, { as: 'rat' })
      }
    }
  })

  return Ship
}
