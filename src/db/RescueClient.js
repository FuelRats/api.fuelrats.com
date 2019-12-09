import { validCMDRname, IRCNickname, languageCode } from '../classes/Validators'

export default function RescueClient (sequelize, DataTypes) {
  const rescueClient = sequelize.define('RescueClient', {
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
        validCMDRname
      }
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: true,
      validate:  {
        IRCNickname
      }
    },
    language: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        languageCode
      }
    }
  })

  rescueClient.associate = function (models) {
    models.RescueClient.hasOne(models.Rescue, {
      as: 'rescue'
    })
  }

  return rescueClient
}
