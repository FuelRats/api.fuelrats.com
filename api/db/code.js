'use strict'

module.exports = function (sequelize, DataTypes) {
  let Code = sequelize.define('Code', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    scope: {
      type: DataTypes.ARRAY(DataTypes.STRING(128)),
      allowNull: false,
      defaultValue: []
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false
    },
    redirectUri: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    classMethods: {
      associate: function (models) {
        Code.belongsTo(models.User, { as: 'user' })
        Code.belongsTo(models.Client, { as: 'client' })
      }
    }
  })

  return Code
}
