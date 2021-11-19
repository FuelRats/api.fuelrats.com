import Model, { column, table, validate, type } from './Model'

@table({})
/**
 * Model class for user sessions
 */
export default class Authenticator extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.STRING)
  static description = undefined

  @column(type.STRING)
  static secret = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        include: [
          {
            model: models.User.scope('norelations'),
            as: 'user',
            required: false,
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
    models.Authenticator.belongsTo(models.User, { as: 'user' })
  }
}
