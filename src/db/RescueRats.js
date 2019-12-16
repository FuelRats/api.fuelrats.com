/* eslint-disable */


export default function RescueRats (sequelize, DataTypes) {
  let rescuerats = sequelize.define('RescueRats', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    rescueId: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    ratId: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    }
  })

  rescuerats.associate = function (models) {
    models.RescueRats.belongsTo(models.Rescue, { foreignKey: 'rescueId' })
    models.RescueRats.belongsTo(models.Rat, { foreignKey: 'ratId' })
  }

  return rescuerats
}
