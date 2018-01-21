import {JSONObject, RescueQuote} from '../classes/Validators'
const MAX_CLIENT_NAME_LENGTH = 64
const MAX_NOTES_LENGTH = 2048
const MAX_SYSTEMLENGTH = 64
const MAX_TITLE_LENGTH = 64

module.exports = function (sequelize, DataTypes) {
  let rescue = sequelize.define('Rescue', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    client: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [1, MAX_CLIENT_NAME_LENGTH]
      }
    },
    codeRed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        JSONObject
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
      validate: {
        len: [0, MAX_NOTES_LENGTH]
      }
    },
    platform: {
      type: DataTypes.ENUM('xb', 'pc', 'ps'),
      allowNull: true,
      defaultValue: 'pc',
      validate: {
        notEmpty: true,
        isIn: ['pc', 'xb', 'ps']
      }
    },
    quotes: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: false,
      defaultValue: [],
      validate: {
        RescueQuote
      }
    },
    status: {
      type: DataTypes.ENUM('open', 'inactive', 'closed'),
      allowNull: false,
      defaultValue: 'open',
      validate: {
        notEmpty: true,
        isIn: ['open', 'inactive', 'closed']
      }
    },
    system: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      validate: {
        len: [1, MAX_SYSTEMLENGTH],
        isUppercase: true
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      validate: {
        len: [1, MAX_TITLE_LENGTH],
        isAlphanumeric: true
      }
    },
    outcome: {
      type: DataTypes.ENUM('success', 'failure', 'invalid', 'other'),
      allowNull: true,
      defaultValue:  null,
      validate: {
        notEmpty: true,
        isIn: ['success', 'failure', 'invalid', 'other']
      }
    },
    unidentifiedRats: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: []
    },
    firstLimpetId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    }
  }, {
    paranoid: true,
    indexes: [{
      fields: ['data'],
      using: 'gin',
      operator: 'jsonb_path_ops'
    }]
  })

  rescue.associate = function (models) {
    models.Rescue.belongsTo(models.Rat, {
      as: 'firstLimpet',
      foreignKey: 'firstLimpetId'
    })

    models.Rescue.belongsToMany(models.Rat, {
      as: 'rats',
      through: {
        model: models.RescueRats
      }
    })

    models.Rescue.hasMany(models.Epic, { foreignKey: 'rescueId', as: 'epics' })

    models.Rescue.addScope('rescue', {
      include: [
        {
          model: models.Rat,
          as: 'rats',
          required: false,
          through: {
            attributes: []
          }
        },
        {
          model: models.Rat,
          as: 'firstLimpet',
          required: false
        },
        {
          model: models.Epic,
          as: 'epics',
          required: false
        }
      ]
    }, {
      override: true
    })
  }

  return rescue
}
