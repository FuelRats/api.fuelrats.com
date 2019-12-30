import Model, { column, table, validate, type } from './Model'

@table({})
export default class UserGroups extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ isAlphanumeric: true, notEmpty: true })
  @column(type.STRING)
  static groupId = undefined

  @validate({ isUUID: 4 })
  @column(type.UUID)
  static userId = undefined

  static associate (models) {
    super.associate(models)
    models.UserGroups.belongsTo(models.User, { foreignKey: 'userId' })
    models.UserGroups.belongsTo(models.Group, { foreignKey: 'groupId' })
  }
}
