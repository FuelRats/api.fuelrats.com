import { IRCVirtualHost, OAuthScope } from '../classes/Validators'
import Model, { column, table, validate, type } from './Model'

@table({ paranoid: true })
export default class Group extends Model {
  @validate({ isAlphanumeric: true, notEmpty: true })
  @column(type.STRING, { primaryKey: true })
  static id = undefined

  @validate({ is: IRCVirtualHost })
  @column(type.STRING, { allowNull: true })
  static vhost = undefined

  @column(type.BOOLEAN)
  static withoutPrefix = false

  @validate({ isInt: true })
  @column(type.INTEGER)
  static priority = 0

  @validate({ OAuthScope })
  @column(type.ARRAY(type.STRING))
  static permissions = []

  static getScopes () {
    return {
      stats: [{
        attributes: []
      }]
    }
  }

  static associate (models) {
    super.associate(models)
    models.Group.belongsToMany(models.User, {
      as: 'users',
      foreignKey: 'groupId',
      through: {
        model: models.UserGroups,
        foreignKey: 'groupId'
      }
    })
  }
}
