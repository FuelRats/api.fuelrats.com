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
      type: DataTypes.ENUM('pc', 'xb'),
      allowNull: false,
      defaultValue: 'pc'
    }
  }, {
    paranoid: true
  })

  return Rat
}
