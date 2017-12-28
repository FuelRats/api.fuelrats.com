

module.exports = function (sequelize, DataTypes) {
  let Rescue = sequelize.define('Rescue', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    client: {
      type: DataTypes.STRING,
      allowNull: true
    },
    codeRed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    },
    platform: {
      type: DataTypes.ENUM('xb', 'pc', 'ps'),
      allowNull: true,
      defaultValue: 'pc'
    },
    quotes: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('open', 'inactive', 'closed'),
      allowNull: false,
      defaultValue: 'open'
    },
    system: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    outcome: {
      type: DataTypes.ENUM('success', 'failure', 'invalid', 'other'),
      allowNull: true,
      defaultValue:  null
    },
    unidentifiedRats: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: []
    }
  }, {
    paranoid: true,
    indexes: [{
      fields: ['data'],
      using: 'gin',
      operator: 'jsonb_path_ops'
    }]
  })

  Rescue.associate = function (models) {
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

  return Rescue
}
