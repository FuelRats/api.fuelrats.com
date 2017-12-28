

module.exports = function (sequelize, DataTypes) {
  let Action = sequelize.define('Action', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    inet: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('login'),
      allowNull: false,
      defaultValue: 'login'
    }
  })

  Action.associate = function (models) {
    models.Action.belongsTo(models.User, { as: 'user' })
  }

  return Action
}
