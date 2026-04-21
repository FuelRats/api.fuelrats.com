import * as constants from '../constants'
import { hashPassword } from '../helpers/password'
import Model, { column, table, type, validate } from './Model'
import { OAuthClientName, isURL } from '../helpers/Validators'

const clientSecretEncodedMaxLength = 1024
const clientSecretMinLength = 32
const clientSecretMaxLength = 512

/**
 * OAuth Client table model
 */
@table({})
export default class Client extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** OAuth client display name */
  @validate({ is: OAuthClientName }, { name: 'name' })
  @column(type.STRING, { name: 'name' })
  static clientName = undefined

  /** OAuth client secret (bcrypt hashed) */
  @validate({ len: [clientSecretMinLength, clientSecretMaxLength] })
  @column(type.STRING(clientSecretEncodedMaxLength))
  static secret = undefined

  /** OAuth redirect URI */
  @validate({ isURL })
  @column(type.STRING, { allowNull: true })
  static redirectUri = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static userId = undefined

  /** Allowed OAuth scopes for this client */
  @column(type.ARRAY(type.STRING))
  static namespaces = []

  /** Whether this is a first-party Fuel Rats client */
  @column(type.BOOLEAN)
  static firstParty = false

  /**
   * Function that runs when one attempts to set a new value to the client secret field, hashing the value
   * @param {Client} instance client model instance
   * @returns {Promise<void>}
   */
  static async hashPasswordHook (instance) {
    if (!instance.changed('secret')) {
      return
    }
    const hash = await hashPassword(instance.get('secret'), constants.bcryptRoundsCount)
    instance.set('secret', hash)
  }

  /**
   * Removes the client secret from the json output of this model
   * @returns {object} json output of the model without the client secret
   */
  toJSON () {
    const values = this.get()
    delete values.secret
    return values
  }

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      user: [{
        include: [
          {
            model: models.User.scope('norelations'),
            as: 'user',
            required: true,
          },
        ],
      }, {
        override: true,
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    Client.beforeCreate(Client.hashPasswordHook)
    Client.beforeUpdate(Client.hashPasswordHook)

    models.Client.belongsTo(models.User, { foreignKey: 'userId', as: 'user' })
  }
}
