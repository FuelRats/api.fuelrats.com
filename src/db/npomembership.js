

module.exports = function (sequelize, DataTypes) {
  let npoMembership = sequelize.define('NPOmembership', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    }
  }, {
    paranoid: true
  })

  npoMembership.associate = function (models) {
    models.npoMembership.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    })

    models.npoMembership.addScope('defaultScope', {
      include: [{
        model: models.User,
        as: 'user'
      }]
    }, { override: true })
  }



  return npoMembership
}
