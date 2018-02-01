import { OAuthScope, isURL } from '../classes/Validators'

const OAUTH_SCOPE_MAX_LENGTH = 128
const MIN_TOKEN_LENGTH = 24
const MAX_TOKEN_LENGTH = 128
const MAX_URL_LENGTH = 255

module.exports = function (sequelize, DataTypes) {
  let code = sequelize.define('Code', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
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
        isAlphanumeric: true,
        len: [MIN_TOKEN_LENGTH, MAX_TOKEN_LENGTH],
        notEmpty: true
      }
    },
    redirectUri: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        isURL,
        notEmpty: true,
        len: [1, MAX_URL_LENGTH]
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    },
    clientId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    }
  })

  code.associate = function (models) {
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

  return code
}
