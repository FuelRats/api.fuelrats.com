'use strict'

module.exports = function (sequelize, DataTypes) {
  let Epic = sequelize.define('Epic', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    classMethods: {
      associate: function (models) {
        Epic.belongsTo(models.Rescue, { as: 'rescue' })
        Epic.belongsTo(models.Rat, { as: 'rat' })
      }
    }
  })

  return Epic
}
