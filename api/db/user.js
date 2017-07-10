'use strict'

module.exports = function (db, DataTypes) {
  let User = db.define('User', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
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
        include: [
          [models.db.cast(models.db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
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
        },
        {
          model: models.Group,
          as: 'groups',
          require: false,
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
    models.User.addScope('internal', {
      attributes: {
        include: [
          [models.db.cast(models.db.col('nicknames'), 'text[]'), 'nicknames']
        ],
        exclude: [
          'nicknames',
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
        },
        {
          model: models.Group,
          as: 'groups',
          require: false,
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
  }
  return User
}
