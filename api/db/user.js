'use strict'

module.exports = function (db, DataTypes) {
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
      defaultValue: db.literal('ARRAY[]::citext[]')
    },
    groups: {
      type: DataTypes.ARRAY(DataTypes.STRING(128)),
      allowNull: false,
      defaultValue: []
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
