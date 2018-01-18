import bcrypt from 'bcrypt'
import {JSONObject} from '../classes/Validators'

const PASSWORD_MAX_LENGTH = 1024
const NICKNAME_MAX_LENGTH = 30


module.exports = function (db, DataTypes) {
  let user = db.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: true
      }
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
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

  let hashPasswordHook = async function (instance, done) {
    if (!instance.changed('password')) {
      done()
      return
    }
    let hash = await bcrypt.hash(instance.get('password'), global.BCRYPT_ROUNDS_COUNT)
    instance.set('password', hash)
    done()
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

  user.isSuspended = function (user) {
    if (!user.data.attributes.suspended) {
      return false
    }

    return user.data.attributes.suspended - Date.now() > 0
  }

  user.prototype.isDeactivated = function () {
    return this.status === 'deactivated'
  }

  user.isDeactivated = function (user) {
    return user.data.attributes.status === 'deactivated'
  }

  user.prototype.isConfirmed = function () {
    return this.groups.length > 0
  }

  user.isConfirmed = function (user) {
    return user.data.relationships.groups.data.length > 0
  }

  user.preferredRat = function (user) {
    let ratRef = (user.data.relationships.displayRat.data || user.data.relationships.rats.data[0])
    if (!ratRef) {
      return null
    }

    return user.included.find((include) => {
      return include.id === ratRef.id
    })
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
          as: 'rats',
          attributes: {
            exclude: [
              'deletedAt'
            ]
          }
        }, {
          model: models.Rat,
          as: 'displayRat',
          attributes: {
            exclude: [
              'deletedAt'
            ]
          }
        }, {
          model: models.Group,
          as: 'groups',
          required: false,
          through: {
            attributes: []
          },
          attributes: {
            exclude: [
              'deletedAt'
            ]
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
          as: 'displayRat',
          attributes: {
            exclude: [
              'deletedAt'
            ]
          }
        }, {
          model: models.Group,
          as: 'groups',
          required: false,
          through: {
            attributes: []
          },
          attributes: {
            exclude: [
              'deletedAt'
            ]
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
          attributes: {
            exclude: [
              'deletedAt'
            ]
          },
          include: [{
            model: models.Ship,
            as: 'ships',
            required: false,
            attributes: {
              exclude: [
                'deletedAt'
              ]
            }
          }]
        },
        {
          model: models.Rat,
          as: 'displayRat',
          attributes: {
            exclude: [
              'deletedAt'
            ]
          },

          include: [{
            model: models.Ship,
            as: 'ships',
            required: false,
            attributes: {
              exclude: [
                'deletedAt'
              ]
            }
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
