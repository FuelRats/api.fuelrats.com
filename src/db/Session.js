/* eslint-disable */

export default function Session (sequelize, DataTypes) {
  const session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    ip: {
      type: DataTypes.INET,
      allowNull: false
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastAccess: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    }
  }, {
    indexes: [{
      fields: ['ip', 'userAgent', 'code']
    }]
  })

  session.associate = function (models) {
    models.Session.belongsTo(models.User, { as: 'user' })

    models.Session.addScope('defaultScope', {
      include: [
        {
          model: models.User,
          as: 'user',
          required: true
        }
      ]
    }, {
      override: true
    })
  }

  return session
}
