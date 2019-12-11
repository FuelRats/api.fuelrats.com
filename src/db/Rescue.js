
import { IRCNickname, JSONObject, languageCode, RescueQuote, validCMDRname } from '../classes/Validators'
import RescueView from '../view/RescueView'

/* eslint max-lines-per-function:0 */

const rescueClientNameMaxLength = 64
const rescueNotesMaxLength = 2048
const rescueSystemMaxLength = 64
const rescueTitleMaxLength = 64

/**
 *
 * @param sequelize
 * @param DataTypes
 * @returns {void|Model|*}
 * @constructor
 */
export default function Rescue (sequelize, DataTypes) {
  const rescue = sequelize.define('Rescue', {
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
      allowNull: false,
      validate: {
        validCMDRname
      }
    },
    clientNick: {
      type: DataTypes.STRING,
      allowNull: true,
      validate:  {
        IRCNickname
      }
    },
    clientLanguage: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        languageCode
      }
    },
    commandIdentifier: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isInt: true,
        min: 0
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
        len: [0, rescueNotesMaxLength]
      }
    },
    platform: {
      type: DataTypes.ENUM('xb', 'pc', 'ps'),
      allowNull: true,
      defaultValue: 'pc',
      validate: {
        notEmpty: true,
        isIn: [['pc', 'xb', 'ps']]
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
        isIn: [['open', 'inactive', 'closed']]
      }
    },
    system: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: undefined,
      validate: {
        len: [1, rescueSystemMaxLength],
        isUppercase: true
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: undefined,
      validate: {
        len: [1, rescueTitleMaxLength],
        isAlphanumeric: true
      }
    },
    outcome: {
      type: DataTypes.ENUM('success', 'failure', 'invalid', 'other', 'purge'),
      allowNull: true,
      defaultValue: undefined,
      validate: {
        notEmpty: true,
        isIn: [['success', 'failure', 'invalid', 'other', 'purge']]
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
      foreignKey: 'rescueId',
      through: {
        model: models.RescueRats,
        foreignKey: 'rescueId'
      }
    })

    models.Rescue.hasMany(models.Epic, { foreignKey: 'rescueId', as: 'epics' })

    models.Rescue.addScope('defaultScope', {
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
