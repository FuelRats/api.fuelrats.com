import bcrypt from 'bcrypt'
import * as constants from '../constants'
import Model, { column, table, validate, type } from './Model'
import { JSONObject } from '../helpers/Validators'

const passwordMinLength = 12
const passwordMaxLength = 1024

/**
 * Get an IRC host safe version of a rat name for use in a virtual host
 * @param {string} cmdrName the rat name which should be used
 * @returns {string} the generated irc safe name
 */
function getIRCSafeName (cmdrName) {
  let name = cmdrName
  name = name.replace(/ /gu, '')
  name = name.replace(/[^a-zA-Z0-9\s]/gu, '')
  return name.toLowerCase()
}


/**
 * Model class for users
 */
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

  @column(type.VIRTUAL(type.ARRAY(type.STRING)), {
    include: [],
    get () {
      if (!this.groups) {
        return undefined
      }
      const permissions = Array.from(new Set(this.groups.reduce((accumulator, value) => {
        return accumulator.concat(value.permissions)
      }, [])))

      if (permissions.length === 0) {
        return undefined
      }
      return permissions
    },
    allowNull: true,
  })
  static permissions = undefined

  /**
   * Function triggered when attempting to change the value of a user password, which hashes it.
   * @param {User} instance user model instance
   * @returns {Promise<void>}
   */
  static hashPasswordHook = async (instance) => {
    if (!instance.changed('password')) {
      return
    }
    const hash = await bcrypt.hash(instance.get('password'), constants.bcryptRoundsCount)
    instance.set('password', hash)
  }

  /**
   * Override function that ensures password is removed from JSON user results
   * @returns {object}
   */
  toJSON () {
    const values = this.get()
    delete values.password
    return values
  }

  /**
   * Returns whether or not this user has been suspended
   * @returns {boolean}
   */
  isSuspended () {
    if (!this.suspended) {
      return false
    }

    return this.suspended - new Date() > 0
  }

  /**
   * Returns whether or not this user has been deactivated
   * @returns {boolean}
   */
  isDeactivated () {
    return this.status === 'deactivated'
  }

  /**
   * Returns whether or not this user has had their email verified
   * @returns {boolean}
   */
  isConfirmed () {
    return this.groups.some((group) => {
      return group.name === 'verified'
    })
  }

  /**
   * Returns the "preferred" rat of a user, also known as their display rat, or display name.
   * @returns {Model}
   */
  preferredRat () {
    if (this.displayRat) {
      return this.displayRat
    }
    return this.rats[0]
  }

  /**
   * Returns the vhost that should be used for this user based on their permission levels
   * @returns {string|undefined}
   */
  vhost () {
    if (!this.groups || this.groups.length === 0) {
      return undefined
    }

    const groups = this.groups.filter((group) => {
      return Boolean(group.vhost)
    })

    const [group] = groups.sort((group1, group2) => {
      return group2.priority - group1.priority
    })

    if (group.withoutPrefix) {
      return group.vhost
    }
    const rat = this.preferredRat()
    const identifier = rat ? rat.name : this.id

    return `${getIRCSafeName(identifier)}.${group.vhost}`
  }

  /**
   * Get the appropriate IRC channel flags for this user
   * @returns {*} channel flags
   */
  flags () {
    if (!this.groups || this.groups.length === 0) {
      return undefined
    }


    return this.groups.reduce((acc, { channels }) => {
      Object.entries(channels).forEach(([chan, flag]) => {
        if (acc[chan] && !acc[chan].includes(flag)) {
          acc[chan].push(flag)
        } else if (!acc[chan]) {
          acc[chan] = [flag]
        }
      })
      return acc
    }, {})
  }

  /**
   * @inheritdoc
   */
  static getScopes (models) {
    return {
      defaultScope: [{
        attributes: {
          exclude: [
            'permissions',
          ],
        },
        include: [
          {
            model: models.Rat,
            as: 'rats',
            required: false,
          },
          {
            model: models.Decal,
            as: 'decals',
            required: false,
            include: [],
          },
          {
            model: models.Avatar,
            as: 'avatar',
            required: false,
          },
          {
            model: models.Rat,
            as: 'displayRat',
          }, {
            model: models.Group,
            as: 'groups',
            required: false,
            through: {
              attributes: ['userId'],
            },
            include: [],
            order: [
              ['priority', 'DESC'],
            ],
          }, {
            model: models.Client,
            as: 'clients',
            required: false,
            include: [],
          }, {
            model: models.Epic,
            as: 'epics',
            required: false,
            through: {},
            include: [],
          },
          {
            model: models.Authenticator,
            as: 'authenticator',
            required: false,
          },
        ],
      }, { override: true }],

      public: [{
        attributes: {
          exclude: [
            'permissions',
          ],
        },
        include: [
          {
            model: models.Rat,
            as: 'rats',
            required: false,
          },
          {
            model: models.Avatar,
            as: 'avatar',
            required: false,
          },
          {
            model: models.Rat,
            as: 'displayRat',
          },
        ],
      }, { override: true }],


      norelations: [{
        attributes: {
          exclude: [
            'permissions',
          ],
        },
      }, { override: true }],
    }
  }

  /**
   * @inheritdoc
   */
  static associate (models) {
    super.associate(models)
    User.beforeCreate(User.hashPasswordHook)
    User.beforeUpdate(User.hashPasswordHook)

    models.User.hasMany(models.Rat, {
      as: 'rats',
      foreignKey: 'userId',
    })

    models.User.belongsTo(models.Rat, { as: 'displayRat', constraints: false })

    models.User.hasOne(models.Decal, {
      foreignKey: 'userId',
      as: 'decal',
    })

    models.User.belongsToMany(models.Group, {
      as: 'groups',
      foreignKey: 'userId',
      through: {
        model: models.UserGroups,
        foreignKey: 'userId',
      },
    })

    models.User.belongsToMany(models.Epic, {
      as: 'epics',
      foreignKey: 'userId',
      through: {
        model: models.EpicUsers,
        foreignKey: 'userId',
      },
    })

    models.User.hasMany(models.Client, { foreignKey: 'userId', as: 'clients' })
    models.User.hasMany(models.Decal, { foreignKey: 'userId', as: 'decals' })
    models.User.hasMany(models.Epic, { foreignKey: 'approvedById', as: 'approvedEpics' })
    models.User.hasMany(models.Epic, { foreignKey: 'nominatedById', as: 'nominatedEpics' })

    models.User.hasOne(models.Avatar, { foreignKey: 'userId', as: 'avatar' })
    models.User.hasOne(models.Authenticator, { foreignKey: 'userId', as: 'authenticator' })
  }
}
