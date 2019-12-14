import bcrypt from 'bcrypt'

import { OAuthClientName, isURL } from '../classes/Validators'

const clientSecretEncodedMaxLength = 1024
const clientSecretMinLength = 32
const clientSecretMaxLength = 512

/* eslint-disable jsdoc/require-jsdoc */
export default function Client (sequelize, DataTypes) {
  const client = sequelize.define('Client', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: OAuthClientName
      }
    },
    secret: {
      type: DataTypes.STRING(clientSecretEncodedMaxLength),
      allowNull: false,
      validate: {
        len: [clientSecretMinLength, clientSecretMaxLength]
      }
    },
    redirectUri: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isURL
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    }
  })

  const hashPasswordHook = async function (instance) {
    if (!instance.changed('secret')) {
      return
    }
    const hash = await bcrypt.hash(instance.get('secret'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('secret', hash)
  }
  client.beforeCreate(hashPasswordHook)
  client.beforeUpdate(hashPasswordHook)

  client.prototype.toJSON = function () {
    const values = this.get()
    delete values.secret
    return values
  }

  client.associate = function (models) {
    models.Client.belongsTo(models.User, { foreignKey: 'userId', as: 'user' })


    models.Client.addScope('defaultScope', {
      include: [
        {
          model: models.User.scope('norelations'),
          as: 'user',
          required: true
        }
      ]
    }, {
      override: true
    })
  }

  return client
}
