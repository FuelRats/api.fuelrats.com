'use strict'

module.exports = function (sequelize, DataTypes) {
  let Client = sequelize.define('Client', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    secret: {
      type: DataTypes.STRING(1024),
      allowNull: false
    },
    redirectUri: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    classMethods: {
      associate: function (models) {
        Client.belongsTo(models.User, { as: 'user' })
      }
    }
  })

  return Client
}
