import bcrypt from 'bcrypt'
import {JSONObject, IRCNicknames} from '../classes/Validators'

const PASSWORD_MAX_LENGTH = 1024
const NICKNAME_MAX_LENGTH = 35


module.exports = function (db, DataTypes) {
  let user = db.define('User', {
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
        min: 12,
        max: 1024
      }
    },
    nicknames: {
      type: DataTypes.ARRAY(DataTypes.STRING(NICKNAME_MAX_LENGTH)),
      allowNull: true,
      defaultValue: [],
      set (value) {
        value = value.map(nickname => nickname.toLowerCase())
        this.setDataValue('nicknames', value)
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
        isIn: ['active', 'inactive', 'legacy', 'deactivated']
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

  let hashPasswordHook = async function (instance) {
    if (!instance.changed('password')) {
      return
    }
    let hash = await bcrypt.hash(instance.get('password'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('password', hash)
  }

  user.beforeCreate(hashPasswordHook)
  user.beforeUpdate(hashPasswordHook)

  user.prototype.toJSON = function () {
    let values = this.get()
    delete values.password
    return values
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
      }
    }, { override: true })


    models.User.addScope('public', {
      attributes: {
        exclude: [
          'image',
          'suspended',
          'permissions'
        ]
      },
      include: [
        {
          model: models.Rat,
          as: 'rats'
        }, {
          model: models.Rat,
          as: 'displayRat'
        }, {
          model: models.Group,
          as: 'groups',
          required: false,
          through: {
            attributes: []
          },
          order: [
            ['priority', 'DESC']
          ]
        }
      ]
    }, {
      override: true
    })
    models.User.addScope('internal', {
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
          attributes: {
            exclude: [
              'deletedAt'
            ]
          }
        }, {
          model: models.Rat,
          as: 'displayRat'
        }, {
          model: models.Group,
          as: 'groups',
          required: false,
          through: {
            attributes: []
          }
        }
      ]
    }, {
      override: true
    })

    models.User.addScope('profile', {
      attributes: {
        include: [
          'permissions',
        ],
        exclude: [
          'password',
          'deletedAt',
          'image'
        ]
      },
      include: [
        {
          model: models.Rat,
          as: 'rats',
          include: [{
            model: models.Ship,
            as: 'ships',
            required: false
          }]
        },
        {
          model: models.Rat,
          as: 'displayRat',

          include: [{
            model: models.Ship,
            as: 'ships',
            required: false
          }]
        }, {
          model: models.Group,
          as: 'groups',
          required: false,
          through: {
            attributes: []
          },
          order: [
            ['priority', 'DESC']
          ]
        }, {
          model: models.npoMembership,
          as: 'npoMembership'
        }
      ]
    })


    models.User.hasMany(models.UserGroups)

    models.User.addScope('stats', {
      include: [
        {
          model: models.Rat,
          as: 'displayRat',
          attributes: [
            'id',
            'name'
          ]
        }
      ]
    })

    models.User.addScope('image', {
      attributes: [
        'image'
      ]
    })
  }
  return user
}
