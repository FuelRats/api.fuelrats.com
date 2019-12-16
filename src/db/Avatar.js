/* eslint-disable jsdoc/require-jsdoc */
export default function Avatar (db, DataTypes) {
  const avatar = db.define('Avatar', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    image: {
      type: DataTypes.BLOB(),
      allowNull: false,
      defaultValue: undefined
    }
  })

  avatar.associate = function (models) {
    avatar.belongsTo(models.User, { as: 'user' })

    avatar.addScope('defaultScope', {
      attributes: ['id']
    })

    avatar.addScope('data', {
      attributes: ['id', 'image']
    })

  }

  return avatar
}
