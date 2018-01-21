import bcrypt from 'bcrypt'
import { OAuthClientName, isURL } from '../classes/Validators'

const CLIENT_SECRET_MAX_LENGTH = 1024
const MIN_SECRET_LENGTH = 32
const MAX_SECRET_LENGTH = 512

module.exports = function (sequelize, DataTypes) {
  let client = sequelize.define('Client', {
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
      type: DataTypes.STRING(CLIENT_SECRET_MAX_LENGTH),
      allowNull: false,
      validate: {
        len: [MIN_SECRET_LENGTH, MAX_SECRET_LENGTH]
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

  let hashPasswordHook = async function (instance) {
    if (!instance.changed('secret')) {
      return
    }
    let hash = await bcrypt.hash(instance.get('secret'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('secret', hash)
  }
  client.beforeCreate(hashPasswordHook)
  client.beforeUpdate(hashPasswordHook)

  client.prototype.toJSON = function () {
    let values = this.get()
    delete values.secret
    return values
  }

  client.associate = function (models) {
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
  }

  return client
}
