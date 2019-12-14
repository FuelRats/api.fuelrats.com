/* eslint-disable jsdoc/require-jsdoc */
const epicsNotesFieldMaxLength = 2048

export default function Epic (sequelize, DataTypes) {
  const epic = sequelize.define('Epic', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [0, epicsNotesFieldMaxLength]
      }
    },
    rescueId: {
      type: DataTypes.UUID,
      allowNull: true,
      validate: {
        isUUID: 4
      }
    },
    ratId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: 4
      }
    },
    approvedById: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: undefined,
      validate: {
        isUUID: 4
      }
    },
    nominatedById: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: undefined,
      validate: {
        isUUID: 4
      }
    }
  }, {
    paranoid: true
  })

  epic.associate = function (models) {
    models.Epic.belongsTo(models.Rescue, { as: 'rescue' })
    models.Epic.belongsTo(models.Rat, { as: 'rat' })
    models.Epic.belongsTo(models.User, {
      as: 'approvedBy',
      foreignKey: 'approvedById'
    })
    models.Epic.belongsTo(models.User, {
      as: 'nominatedBy',
      foreignKey: 'nominatedById'
    })
  }

  return epic
}
