'use strict'

const OAUTH_SCOPE_MAX_LENGTH = 128

module.exports = function (sequelize, DataTypes) {
  let Code = sequelize.define('Code', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    scope: {
      type: DataTypes.ARRAY(DataTypes.STRING(OAUTH_SCOPE_MAX_LENGTH)),
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
  })

  Code.associate = function (models) {
    models.Code.belongsTo(models.User, { as: 'user' })
    models.Code.belongsTo(models.Client, { as: 'client' })

    models.Code.addScope('defaultScope', {
      include: [
        {
          model: models.User,
          as: 'user',
          required: true
        }
      ]
    }, {
      override: true
    })
  }

  return Code
}
