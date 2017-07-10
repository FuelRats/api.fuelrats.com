'use strict'

module.exports = function (sequelize, DataTypes) {
  let Rat = sequelize.define('Rat', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    joined: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    platform: {
      type: DataTypes.ENUM('pc', 'xb', 'ps'),
      allowNull: false,
      defaultValue: 'pc'
    }
  }, {
    paranoid: true
  })

  Rat.associate = function (models) {
    models.Rat.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    })



    models.Rescue.belongsToMany(models.Rat, {
      as: 'rats',
      through: {
        model: models.RescueRats
      }
    })

    models.Rat.belongsToMany(models.Rescue, {
      as: 'rescues',
      through: {
        model: models.RescueRats
      }
    })

    models.Rat.hasMany(models.Rescue, { foreignKey: 'firstLimpetId', as: 'firstLimpet' })

    models.Rat.hasMany(models.Ship, {
      foreignKey: 'ratId',
      as: 'ships'
    })

    models.Rat.hasMany(models.Epic, { foreignKey: 'ratId', as: 'epics' })
  }

  return Rat
}
