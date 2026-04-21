import Model, { column, table, validate, type } from './Model'
import Permission from '../classes/Permission'

const oAuthScopeMaxLength = 128


/**
 * Model class for OAuth tokens
 */
@table({})
export default class Token extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  /** Granted OAuth permission scopes */
  @validate({ scope: Permission.assertOAuthScopes })
  @column(type.ARRAY(type.STRING(oAuthScopeMaxLength)))
  static scope = []

  /** OAuth token string */
  @validate({})
  @column(type.TEXT)
  static value = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static clientId = undefined

  /** IP address that created the token */
  @column(type.STRING, { allowNull: true })
  static ipAddress = undefined

  /** User-Agent string of the requesting client */
  @column(type.TEXT, { allowNull: true })
  static userAgent = undefined

  /** Authentication method used to obtain the token */
  @column(type.STRING, { allowNull: true })
  static authMethod = undefined

  /** Timestamp of last token usage */
  @column(type.DATE, { allowNull: true })
  static lastAccess = undefined

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        include: [
          {
            model: models.User,
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
    models.Token.belongsTo(models.User, { as: 'user' })
    models.Token.belongsTo(models.Client, { as: 'client', foreignKey: 'clientId' })
  }
}

