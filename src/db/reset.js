

module.exports = function (sequelize, DataTypes) {
  let reset = sequelize.define('Reset', {
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

  reset.associate = function (models) {
    models.Reset.belongsTo(models.User, { as: 'user' })
  }

  return reset
}
