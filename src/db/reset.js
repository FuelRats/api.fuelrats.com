

module.exports = function (sequelize, DataTypes) {
  let reset = sequelize.define('Reset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: true
      }
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isAlphanumeric: true,
        min: 16,
        max: 128
      }
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true
      }
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      validate: {
        isIn: [true, false]
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: true
      }
    }
  })

  reset.associate = function (models) {
    models.Reset.belongsTo(models.User, { as: 'user' })
  }

  return reset
}
