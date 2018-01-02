

module.exports = function (sequelize, DataTypes) {
  let epic = sequelize.define('Epic', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  })

  epic.associate = function (models) {
    models.Epic.belongsTo(models.Rescue, { as: 'rescue' })
    models.Epic.belongsTo(models.Rat, { as: 'rat' })
  }

  return epic
}
