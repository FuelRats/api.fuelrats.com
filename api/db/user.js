'use strict'

module.exports = function (sequelize, DataTypes) {
  let User = sequelize.define('User', {
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
      defaultValue: sequelize.literal('ARRAY[]::citext[]')
    },
    drilled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    drilledDispatch: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    group: {
      type: DataTypes.ENUM('normal', 'overseer', 'moderator', 'admin'),
      allowNull: false,
      defaultValue: 'normal'
    },
    dispatch: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: null,
      unique: true
    }
  }, {
    paranoid: true,
    classMethods: {
      associate: function (models) {
        User.hasMany(models.Rat, { as: 'rats' })
      }
    }
  })

  return User
}
