

module.exports = function (sequelize, DataTypes) {
  let action = sequelize.define('Action', {
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

  action.associate = function (models) {
    models.Action.belongsTo(models.User, { as: 'user' })
  }

  return action
}
