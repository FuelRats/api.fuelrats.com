import Model, { table, column, validate, type } from './Model'

@table({})
/**
 * User avatar model
 */
export default class Avatar extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @column(type.BLOB())
  static image = undefined

  /**
   * @inheritdoc
   */
  static getScopes () {
    return {
      defaultScope: [{
        attributes: ['id'],
      }],

      data: [{
        attributes: ['id', 'image'],
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)

    models.Avatar.belongsTo(models.User, { as: 'user' })
  }
}
