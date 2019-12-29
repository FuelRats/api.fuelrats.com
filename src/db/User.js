import bcrypt from 'bcrypt'
import UserView from '../view/UserView'
import { JSONObject } from '../classes/Validators'
import Model, { column, table, validate, type } from './Model'

const passwordMinLength = 12
const passwordMaxLength = 1024

@table({ paranoid: true })
export default class User extends Model {
  @validate({ isUUID: 4 })
  @column(type.UUID, { primaryKey: true })
  static id = type.UUIDV4

  @validate({ JSONObject })
  @column(type.JSONB)
  static data = {}

  @validate({ isEmail: true })
  @column(type.STRING)
  static email = undefined

  @validate({ len: [passwordMinLength, passwordMaxLength] })
  @column(type.STRING(passwordMaxLength))
  static password = undefined

  @validate({ isInt: true })
  @column(type.INTEGER, { allowNull: true })
  static frontierId = undefined

  @column(type.ENUM('active', 'inactive', 'legacy', 'deactivated'))
  static status = 'active'

  @column(type.DATE, { allowNull: true })
  static suspended = undefined

  @column(type.VIRTUAL(type.BOOLEAN), { include: [], get () {
    return Boolean(this.avatar)
  } })
  static image = undefined

  @column(type.VIRTUAL(type.ARRAY(type.STRING)), { include: [], get () {
    if (!this.groups) {
      return []
    }
    return this.groups.reduce((accumulator, value) => {
      return accumulator.concat(value.permissions)
    }, [])
  } })
  static permissions = undefined

  static hashPasswordHook = async function (instance) {
    if (!instance.changed('password')) {
      return
    }
    const hash = await bcrypt.hash(instance.get('password'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('password', hash)
  }

  toJSON () {
    const values = this.get()
    delete values.password
    return values
  }

  isSuspended () {
    if (!this.suspended) {
      return false
    }

    return this.suspended - new Date() > 0
  }

  isDeactivated () {
    return this.status === 'deactivated'
  }

  isConfirmed () {
    return this.groups.length > 0
  }

  preferredRat () {
    if (this.displayRat) {
      return this.displayRat
    }
    return this.rats[0]
  }

  vhost () {
    if (!this.groups || this.groups.length === 0) {
      return undefined
    }

    const [group] = this.groups.sort((group1, group2) => {
      return group1.priority - group2.priority
    })

    if (group.withoutPrefix) {
      return group.vhost
    }
    const rat = this.preferredRat()
    const identifier = rat ? rat.name : this.id

    return `${getIRCSafeName(identifier)}.${group.vhost}`
  }

  static getScopes (models) {
    return {
      defaultScope: [{
        attributes: {
          exclude: [
            'permissions',
            'image'
          ]
        },
        include: [
          {
            model: models.Rat,
            as: 'rats',
            required: false,
            include: [{
              model: models.Ship,
              as: 'ships',
              required: false,
              include: []
            }]
          },
          {
            model: models.Avatar,
            as: 'avatar',
            required: false
          },
          {
            model: models.Rat,
            as: 'displayRat',

            include: [{
              model: models.Ship,
              as: 'ships',
              required: false,
              include: []
            }]
          }, {
            model: models.Group,
            as: 'groups',
            required: false,
            through: {
              attributes: ['userId']
            },
            include: [],
            order: [
              ['priority', 'DESC']
            ]
          }, {
            model: models.Client,
            as: 'clients',
            required: false,
            include: []
          }
        ]
      }, { override: true }],

      norelations: [{
        attributes: {
          exclude: [
            'permissions',
            'image'
          ]
        }
      }, { override: true }]
    }
  }

  static associate (models) {
    super.associate(models)
    User.beforeCreate(User.hashPasswordHook)
    User.beforeUpdate(User.hashPasswordHook)

    models.User.hasMany(models.Rat, {
      as: 'rats',
      foreignKey: 'userId'
    })

    models.User.belongsTo(models.Rat, { as: 'displayRat', constraints: false })

    models.User.hasOne(models.Decal, {
      foreignKey: 'userId',
      as: 'decal'
    })

    models.User.belongsToMany(models.Group, {
      as: 'groups',
      foreignKey: 'userId',
      through: {
        model: models.UserGroups,
        foreignKey: 'userId'
      }
    })

    models.User.belongsToMany(models.Epic, {
      as: 'epics',
      foreignKey: 'userId',
      through: {
        model: models.EpicUsers,
        foreignKey: 'userId'
      }
    })

    models.User.hasMany(models.Client, { foreignKey: 'userId', as: 'clients' })
    models.User.hasMany(models.Epic, { foreignKey: 'approvedById', as: 'approvedEpics' })
    models.User.hasMany(models.Epic, { foreignKey: 'nominatedById', as: 'nominatedEpics' })

    models.User.hasOne(models.Avatar, { foreignKey: 'userId', as: 'avatar' })
  }
}

function getIRCSafeName (rat) {
  let ratName = rat.name
  ratName = ratName.replace(/ /gu, '')
  ratName = ratName.replace(/[^a-zA-Z0-9\s]/gu, '')
  return ratName.toLowerCase()
}
