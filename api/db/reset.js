'use strict'

module.exports = function (sequelize, DataTypes) {
  let Reset = sequelize.define('Reset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: false
    }
  })

  Reset.associate = function (models) {
    models.Reset.belongsTo(models.User, { as: 'user' })
  }

  return Reset
}
