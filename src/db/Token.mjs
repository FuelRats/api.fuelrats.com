import { OAuthScope } from '../classes/Validators'
import Model, { column, table, validate, type } from './Model'

const oAuthScopeMaxLength = 128
const oAuthTokenMinLength = 16
const oAuthTokenMaxLength = 128

@table({})
/**
 * Model class for OAuth tokens
 */
export default class Token extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ OAuthScope })
  @column(type.ARRAY(type.STRING(oAuthScopeMaxLength)))
  static scope = []

  @validate({ len: [oAuthTokenMinLength, oAuthTokenMaxLength], isAlphanumeric: true })
  @column(type.STRING)
  static value = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static clientId = undefined

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
            required: true
          }
        ]
      }, {
        override: true
      }]
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Token.belongsTo(models.User, { as: 'user' })
  }
}

