import bcrypt from 'bcrypt'
import UserView from '../views/User'
import { JSONObject, IRCNicknames } from '../classes/Validators'

const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_LENGTH = 1024
const NICKNAME_MAX_LENGTH = 35


module.exports = function (db, DataTypes) {
  const user = db.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        JSONObject
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(PASSWORD_MAX_LENGTH),
      allowNull: false,
      validate: {
        len: [PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH]
      }
    },
    nicknames: {
      type: DataTypes.ARRAY(DataTypes.STRING(NICKNAME_MAX_LENGTH)),
      allowNull: true,
      defaultValue: [],
      set (value) {
        const lowerValue = value.map((nickname) => {
          return nickname.toLowerCase()
        })
        this.setDataValue('nicknames', lowerValue)
      },
      validate: {
        IRCNicknames
      }
    },
    image: {
      type: DataTypes.BLOB(),
      allowNull: true,
      defaultValue: null
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'legacy', 'deactivated'),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        notEmpty: true,
        isIn: [['active', 'inactive', 'legacy', 'deactivated']]
      }
    },
    suspended: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    permissions: {
      type: DataTypes.VIRTUAL(DataTypes.ARRAY(DataTypes.STRING)),
      get: function () {
        if (!this.groups) {
          return []
        }
        return this.groups.reduce((accumulator, value) => {
          return accumulator.concat(value.permissions)
        }, [])
      },
      include: []
    }
  }, {
    paranoid: true
  })

  const hashPasswordHook = async function (instance) {
    if (!instance.changed('password')) {
      return
    }
    const hash = await bcrypt.hash(instance.get('password'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('password', hash)
  }

  user.beforeCreate(hashPasswordHook)
  user.beforeUpdate(hashPasswordHook)

  user.prototype.toJSON = function () {
    const values = this.get()
    delete values.password
    return values
  }

  user.prototype.renderView = function () {
    return UserView
  }

  user.prototype.isSuspended = function () {
    if (!this.suspended) {
      return false
    }

    return this.suspended - new Date() > 0
  }

  user.prototype.isDeactivated = function () {
    return this.status === 'deactivated'
  }

  user.prototype.isConfirmed = function () {
    return this.groups.length > 0
  }



  user.prototype.preferredRat = function () {
    if (this.displayRat) {
      return this.displayRat
    }
    return this.rats[0]
  }

  user.associate = function (models) {
    models.User.hasMany(models.Rat, {
      as: 'rats',
      foreignKey: 'userId'
    })

    models.User.hasOne(models.npoMembership, {
      as: 'npoMembership',
      foreignKey: 'userId'
    })

    models.User.belongsTo(models.Rat, { as: 'displayRat', constraints: false })

    models.User.hasOne(models.Decal, {
      foreignKey: 'userId',
      as: 'decal'
    })

    models.User.belongsToMany(models.Group, {
      as: 'groups',
      through: {
        model: models.UserGroups
      }
    })

    models.User.addScope('defaultScope', {
      attributes: {
        exclude: [
          'image',
          'permissions'
        ]
      },
      include: [
        {
          model: models.Rat,
          as: 'rats',
          include: [{
            model: models.Ship,
            as: 'ships',
            required: false,
            include: []
          }]
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
            attributes: []
          },
          include: [],
          order: [
            ['priority', 'DESC']
          ]
        }, {
          model: models.npoMembership,
          as: 'npoMembership',
          include: []
        }, {
          model: models.Client,
          as: 'clients',
          required: false,
          include: []
        }
      ]
    }, { override: true })

    models.User.addScope('image', {
      attributes: [
        'image'
      ]
    })

    models.User.hasMany(models.Client, { foreignKey: 'userId', as: 'clients' })
    models.User.hasMany(models.UserGroups)
    models.User.hasMany(models.Epic, { foreignKey: 'approvedById', as: 'approvedEpics' })
    models.User.hasMany(models.Epic, { foreignKey: 'nominatedById', as: 'nominatedEpics' })
  }
  return user
}
