'use strict'

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
      type: DataTypes.STRING(1024),
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
    }
  }, {
    paranoid: true
  })

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
          'deletedAt'
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
