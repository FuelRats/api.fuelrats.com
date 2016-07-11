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
    salt: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nicknames: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true
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
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetTokenExpire: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    classMethods: {
      associate: function (models) {
        User.hasMany(models.Rat, { as: 'rats' })
      }
    }
  })

  return User
}
