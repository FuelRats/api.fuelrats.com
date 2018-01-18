import {UnprocessableEntityAPIError} from '../classes/APIError'


module.exports = function (sequelize, DataTypes) {
  let rat = sequelize.define('Rat', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: true
      }
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        is: /^[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\p{Join_Control} ]{3,64}$/u
      }
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isJSON: function (value) {
          if (typeof value !== 'object') {
            throw new UnprocessableEntityAPIError({ pointer: '/data/attributes/data' })
          }
        }
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
        isIn: ['pc', 'xb', 'ps']
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: true
      }
    }
  }, {
    paranoid: true
  })

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
