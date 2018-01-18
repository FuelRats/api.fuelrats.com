import {OAuthScope} from '../classes/Validators'

const OAUTH_SCOPE_MAX_LENGTH = 128

module.exports = function (sequelize, DataTypes) {
  let token = sequelize.define('Token', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: true
      }
    },
    scope: {
      type: DataTypes.ARRAY(DataTypes.STRING(OAUTH_SCOPE_MAX_LENGTH)),
      allowNull: false,
      defaultValue: [],
      validate: {
        OAuthScope
      }
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        min: 24,
        max: 128,
        isAlphanumeric: true
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: true
      }
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: true
      }
    }
  })

  token.associate = function (models) {
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

  return token
}
