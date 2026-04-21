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

  /** Unique group identifier name */
  @validate({ isAlphanumeric: true, notEmpty: true }, { name: 'name' })
  @column(type.STRING, { allowNull: false, unique: true, name: 'name' })
  static groupName = undefined

  /** Human-readable group display name */
  @column(type.STRING, { allowNull: true })
  static displayName = undefined

  /** IRC virtual host suffix assigned to group members */
  @validate({ is: IRCVirtualHost })
  @column(type.STRING, { allowNull: true })
  static vhost = undefined

  /** Associated Jira project roles */
  @column(type.ARRAY(type.STRING), { allowNull: false, defaultValue: [] })
  static jiraRoles = []

  /** Whether the vhost is used without a rat name prefix */
  @column(type.BOOLEAN)
  static withoutPrefix = false

  /** Group priority for vhost and permission ordering */
  @validate({ isInt: true })
  @column(type.INTEGER)
  static priority = 0

  /** OAuth permission scopes granted to group members */
  @validate({ scope: Permission.assertOAuthScopes })
  @column(type.ARRAY(type.STRING))
  static permissions = []

  /** IRC channel access flags for group members */
  @column(type.JSONB)
  static channels = {}

  /** API rate limit override for group members */
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
