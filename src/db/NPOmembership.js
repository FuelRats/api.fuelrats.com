

export default function NPOmembership (sequelize, DataTypes) {
  const npoMembership = sequelize.define('NPOmembership', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: 4
      }
    }
  }, {
    paranoid: true
  })

  npoMembership.associate = function (models) {
    models.npoMembership.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    })
  }



  return npoMembership
}
