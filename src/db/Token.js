import { OAuthScope } from '../classes/Validators'

const oAuthScopeMaxLength = 128
const oAuthTokenMinLength = 16
const oAuthTokenMaxLength = 128

export default function Token (sequelize, DataTypes) {
  const token = sequelize.define('Token', {
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
        notEmpty: true,
        len: [oAuthTokenMinLength, oAuthTokenMaxLength],
        isAlphanumeric: true
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
