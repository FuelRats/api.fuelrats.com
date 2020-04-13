import Permission from '../classes/Permission'
import { isURL } from '../helpers/Validators'
import Model, { column, validate, table, type } from './Model'

const oAuthScopeMaxLength = 128
const oAuthTokenMinLength = 24
const oAuthTokenMaxLength = 128
const oAuthRedirectUriMaxLength = 255

@table({})
/**
 * Model for oauth authorization codes
 */
export default class Code extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ scope: Permission.assertOAuthScopes })
  @column(type.ARRAY(type.STRING(oAuthScopeMaxLength)))
  static scope = []

  @validate({ isAlphanumeric: true, len: [oAuthTokenMinLength, oAuthTokenMaxLength], notEmpty: true })
  @column(type.STRING)
  static value = undefined

  @validate({ isURL, notEmpty: true, len: [1, oAuthRedirectUriMaxLength] })
  @column(type.TEXT)
  static redirectUri = undefined

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
    models.Code.belongsTo(models.User, { as: 'user' })
  }
}
