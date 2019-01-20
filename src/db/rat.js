import { CMDRname, JSONObject } from '../classes/Validators'
import RatView from '../views/Rat'

module.exports = function (sequelize, DataTypes) {
  const rat = sequelize.define('Rat', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: CMDRname
      }
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        JSONObject
      }
    },
    joined: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    platform: {
      type: DataTypes.ENUM('pc', 'xb', 'ps'),
      allowNull: false,
      defaultValue: 'pc',
      validate: {
        notEmpty: true,
        isIn: [['pc', 'xb', 'ps']]
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    }
  }, {
    paranoid: true
  })

  rat.prototype.renderView = function () {
    return RatView
  }

  rat.associate = function (models) {
    models.Rat.addScope('stats', {})
    models.Rat.addScope('defaultScope', {
      include: [{
        model: models.Ship,
        as: 'ships'
      }]
    }, { override: true })


    models.Rat.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    })

    models.Rat.belongsToMany(models.Rescue, {
      as: 'rescues',
      through: {
        model: models.RescueRats
      }
    })

    models.Rat.hasMany(models.Rescue, { foreignKey: 'firstLimpetId', as: 'firstLimpet' })

    models.Rat.hasMany(models.Ship, {
      foreignKey: 'ratId',
      as: 'ships'
    })

    models.Rat.hasMany(models.Epic, { foreignKey: 'ratId', as: 'epics' })
  }

  return rat
}
