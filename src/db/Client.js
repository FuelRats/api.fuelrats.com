import bcrypt from 'bcrypt'

import { OAuthClientName, isURL } from '../classes/Validators'
import Model, { column, table, type, validate } from './Model'

const clientSecretEncodedMaxLength = 1024
const clientSecretMinLength = 32
const clientSecretMaxLength = 512

@table({})
export default class Client extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ is: OAuthClientName }, { name: 'name' })
  @column(type.STRING, { name: 'name' })
  static clientName = undefined

  @validate({ len: [clientSecretMinLength, clientSecretMaxLength] })
  @column(type.STRING(clientSecretEncodedMaxLength))
  static secret = undefined

  @validate({ isURL })
  @column(type.STRING, { allowNull: true })
  static redirectUri = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static userId = undefined

  @column(type.ARRAY(type.STRING))
  static namespaces = []

  @column(type.BOOLEAN)
  static firstParty = false

  static async hashPasswordHook (instance) {
    if (!instance.changed('secret')) {
      return
    }
    const hash = await bcrypt.hash(instance.get('secret'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('secret', hash)
  }

  toJSON () {
    const values = this.get()
    delete values.secret
    return values
  }

  static getScopes (models) {
    return {
      user: [{
        include: [
          {
            model: models.User.scope('norelations'),
            as: 'user',
            required: true
          }
        ]
      }, {
        override: true
      }]
    }
  }

  static associate (models) {
    super.associate(models)
    Client.beforeCreate(Client.hashPasswordHook)
    Client.beforeUpdate(Client.hashPasswordHook)

    models.Client.belongsTo(models.User, { foreignKey: 'userId', as: 'user' })
  }
}
