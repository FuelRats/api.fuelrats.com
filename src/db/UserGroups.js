/* eslint-disable */


export default function UserGroups (sequelize, DataTypes) {
  const usergroups = sequelize.define('UserGroups', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    groupId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: DataTypes.STRING,
      validate: {
        isAlphanumeric: true,
        notEmpty: true
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    }
  })

  usergroups.associate = function (models) {
    models.UserGroups.belongsTo(models.User, { foreignKey: 'userId' })
    models.UserGroups.belongsTo(models.Group, { foreignKey: 'groupId' })
  }

  return usergroups
}
