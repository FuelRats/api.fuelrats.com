import Model, { column, table, validate, type } from './Model'
import Permission from '../classes/Permission'
import { IRCVirtualHost } from '../helpers/Validators'

/**
 * Model class for permission groups
 */
@table({ paranoid: true })
export default class Group extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = undefined

  @validate({ isAlphanumeric: true, notEmpty: true }, { name: 'name' })
  @column(type.STRING, { allowNull: false, unique: true, name: 'name' })
  static groupName = undefined

  @validate({ is: IRCVirtualHost })
  @column(type.STRING, { allowNull: true })
  static vhost = undefined

  @column(type.BOOLEAN)
  static withoutPrefix = false

  @validate({ isInt: true })
  @column(type.INTEGER)
  static priority = 0

  @validate({ scope: Permission.assertOAuthScopes })
  @column(type.ARRAY(type.STRING))
  static permissions = []

  @column(type.JSONB)
  static channels = {}

  @column(type.INTEGER, { allowNull: true })
  static rateLimit = undefined

  /**
   * @inheritdoc
   */
  static getScopes () {
    return {
      stats: [{
        attributes: [],
      }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    models.Group.belongsToMany(models.User, {
      as: 'users',
      foreignKey: 'groupId',
      through: {
        model: models.UserGroups,
        foreignKey: 'groupId',
      },
    })
  }
}
