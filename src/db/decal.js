

module.exports = function (sequelize, DataTypes) {
  let decal = sequelize.define('Decal', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      require: true,
      validate: {
        is: /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-FUE[0-9]{2}$/
      }
    },
    type:  {
      type: DataTypes.ENUM('Rescues', 'Promotional', 'Special'),
      allowNull: false,
      validate: {
        isIn: ['Rescues', 'Promotional', 'Special']
      }
    },
    claimedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        defaultValue: '',
        max: 4096
      }
    },
  }, {
    paranoid: true
  })

  decal.associate = function (models) {
    models.Decal.belongsTo(models.User, { as: 'user' })
  }

  return decal
}
