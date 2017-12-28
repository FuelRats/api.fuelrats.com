

const PASSWORD_MAX_LENGTH = 1024

module.exports = function (db, DataTypes) {
  let User = db.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      isEmail: true
    },
    password: {
      type: DataTypes.STRING(PASSWORD_MAX_LENGTH),
      allowNull: false
    },
    nicknames: {
      type: 'citext[]',
      allowNull: true,
      defaultValue: db.literal('ARRAY[]::citext[]')
    },
    image: {
      type: DataTypes.BLOB(),
      allowNull: true,
      defaultValue: null
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'legacy'),
      allowNull: false,
      defaultValue: 'unconfirmed'
    },
    suspended: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    permissions: {
      type: DataTypes.VIRTUAL(DataTypes.ARRAY(DataTypes.STRING)),
      get: function () {
        return this.groups.reduce((accumulator, value) => {
          return accumulator.concat(value.permissions)
        }, [])
      },
      include: []
    }
  }, {
    paranoid: true
  })

  User.prototype.isSuspended = function () {
    if (!this.suspended) {
      return false
    }

    return this.suspended - new Date() > 0
  }

  User.isSuspended = function (user) {
    if (!user.data.attributes.suspended) {
      return false
    }

    return user.data.attributes.suspended - Date.now() > 0
  }

  User.prototype.isConfirmed = function () {
    return this.groups.length > 0
  }

  User.isConfirmed = function (user) {
    return user.data.relationships.groups.data.length > 0
  }

  User.preferredRat = function (user) {
    let ratRef = (user.data.relationships.displayRat.data || user.data.relationships.rats.data[0])
    if (!ratRef) {
      return null
    }

    return user.included.find((include) => {
      return include.id === ratRef.id
    })
  }

  User.associate = function (models) {
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
      through: {
        model: models.UserGroups
      }
    })


    models.User.addScope('public', {
      attributes: {
        include: [
          [models.db.cast(models.db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
          'image',
          'nicknames',
          'password',
          'suspended',
          'deletedAt',
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
        include: [
          [models.db.cast(models.db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
          'nicknames',
          'image',
          'deletedAt',
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
          [models.db.cast(models.db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
          'nicknames',
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
  return User
}
