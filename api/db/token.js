'use strict'

module.exports = function (sequelize, DataTypes) {
  let Token = sequelize.define('Token', {
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
    }
  })

  Token.associate = function (models) {
    models.Token.belongsTo(models.User, { as: 'user' })
    models.Token.belongsTo(models.Client, { as: 'client' })

    models.Token.addScope('defaultScope', {
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

  return Token
}
