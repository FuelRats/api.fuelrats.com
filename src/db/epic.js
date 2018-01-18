

module.exports = function (sequelize, DataTypes) {
  let epic = sequelize.define('Epic', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: true,
        notEmpty: true
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        max: 2048
      }
    },
    rescueId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: true
      }
    },
    ratId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: true,
        notEmpty: true
      }
    }
  })

  epic.associate = function (models) {
    models.Epic.belongsTo(models.Rescue, { as: 'rescue' })
    models.Epic.belongsTo(models.Rat, { as: 'rat' })
  }

  return epic
}
