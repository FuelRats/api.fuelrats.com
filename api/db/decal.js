'use strict'

module.exports = function (sequelize, DataTypes) {
  let Decal = sequelize.define('Decal', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      require: true,
    },
    type:  {
      type: DataTypes.ENUM('Rescues', 'Promotional', 'Special'),
      allowNull: false
    }
  }, {
    paranoid: true,
    classMethods: {
      associate: function (models) {
        Decal.belongsTo(models.User, { as: 'user' })
      }
    }
  })

  return Decal
}
