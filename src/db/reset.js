const RESET_TOKEN_LENGTH = 32

module.exports = function (sequelize, DataTypes) {
  let reset = sequelize.define('Reset', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isAlphanumeric: true,
        len: [RESET_TOKEN_LENGTH, RESET_TOKEN_LENGTH]
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
      defaultValue: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: 4
      }
    }
  })

  reset.associate = function (models) {
    models.Reset.belongsTo(models.User, { as: 'user' })
  }

  return reset
}
