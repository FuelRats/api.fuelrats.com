

module.exports = function (sequelize, DataTypes) {
  let usergroups = sequelize.define('UserGroups', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    GroupId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: DataTypes.STRING,
      validate: {
        isAlphanumeric: true,
        notEmpty: true
      }
    },
    UserId: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    }
  })

  usergroups.associate = function (models) {
    models.UserGroups.belongsTo(models.User)
    models.UserGroups.belongsTo(models.Group)
  }

  return usergroups
}
