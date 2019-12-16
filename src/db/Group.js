/* eslint-disable jsdoc/require-jsdoc */
import { IRCVirtualHost, OAuthScope } from '../classes/Validators'

export default function Group (sequelize, DataTypes) {
  const group = sequelize.define('Group', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      validate: {
        isAlphanumeric: true,
        notEmpty: true
      }
    },
    vhost: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: IRCVirtualHost
      }
    },
    withoutPrefix: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true
      }
    },
    permissions: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      validate: {
        OAuthScope
      }
    }
  }, {
    paranoid: true
  })

  group.associate = function (models) {
    models.Group.belongsToMany(models.User, {
      as: 'users',
      foreignKey: 'groupId',
      through: {
        model: models.UserGroups,
        foreignKey: 'groupId'
      }
    })

    models.Group.addScope('stats', {
      attributes: []
    })
  }

  return group
}
