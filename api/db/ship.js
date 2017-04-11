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
