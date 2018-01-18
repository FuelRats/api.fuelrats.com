import { OAuthScope } from '../classes/Validators'


const OAUTH_SCOPE_MAX_LENGTH = 128

module.exports = function (sequelize, DataTypes) {
  let code = sequelize.define('Code', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: true,
        notEmpty: true
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
        min: 24,
        max: 128,
        notEmpty: true
      }
    },
    redirectUri: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        isUrl: true,
        notEmpty: true,
        max: 255
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
