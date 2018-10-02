'use strict'

const CLIENT_SECRET_MAX_LENGTH = 1024

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
      type: DataTypes.STRING(CLIENT_SECRET_MAX_LENGTH),
      allowNull: false
    },
    redirectUri: {
      type: DataTypes.STRING,
      allowNull: true
    }
  })

  Client.associate = function (models) {
    models.Client.belongsTo(models.User, { as: 'user' })

    models.Client.addScope('defaultScope', {
      include:  [
        {
          model: models.User,
          as: 'user',
          required: true
        }
      ]
    }, {
      override: true
    })

    models.Client.addScope('public', {
      attributes: {
        include: [
          'id',
          'name',
          'createdAt',
          'updatedAt',
          'redirectUri',
          'userId'
        ],
        exclude: [
          'secret'
        ]
      },
      include: []
    }, {
      override: true
    })
  }

  return Client
}
