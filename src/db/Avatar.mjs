import Model, { table, column, validate, type } from './Model'

/**
 * User avatar model
 */
@table({})
export default class Avatar extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.BLOB())
  static image = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID, { allowNull: true })
  static userId = undefined

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        attributes: {
          exclude: ['image'],
        },
        include: [
          {
            model: models.User.scope('norelations'),
            as: 'user',
            required: false,
          },
        ],
      }],

      imageData: [{
        attributes: ['id', 'image'],
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)

    models.Avatar.belongsTo(models.User, { as: 'user', foreignKey: 'userId' })
  }
}
