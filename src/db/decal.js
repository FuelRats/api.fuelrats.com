'use strict'

module.exports = function (sequelize, DataTypes) {
  let Decal = sequelize.define('Decal', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      require: true,
    },
    type:  {
      type: DataTypes.ENUM('Rescues', 'Promotional', 'Special'),
      allowNull: false
    },
    claimedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
  }, {
    paranoid: true
  })

  Decal.associate = function (models) {
    models.Decal.belongsTo(models.User, { as: 'user' })
  }

  return Decal
}
