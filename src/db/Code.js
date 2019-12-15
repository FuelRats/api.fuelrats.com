import { OAuthScope, isURL } from '../classes/Validators'

const oAuthScopeMaxLength = 128
const oAuthTokenMinLength = 24
const oAuthTokenMaxLength = 128
const oAuthRedirectUriMaxLength = 255

/* eslint-disable jsdoc/require-jsdoc */
export default function Code (sequelize, DataTypes) {
  const code = sequelize.define('Code', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    scope: {
      type: DataTypes.ARRAY(DataTypes.STRING(oAuthScopeMaxLength)),
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
        len: [oAuthTokenMinLength, oAuthTokenMaxLength],
        notEmpty: true
      }
    },
    redirectUri: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        isURL,
        notEmpty: true,
        len: [1, oAuthRedirectUriMaxLength]
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
