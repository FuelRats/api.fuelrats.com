const verificationTokenLength = 32

export default function VerificationToken (sequelize, DataTypes) {
  const verification = sequelize.define('VerificationToken', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      validate: {
        isUUID: 4
      }
    },
    value: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isAlphanumeric: true,
        len: [verificationTokenLength, verificationTokenLength]
      }
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true
      }
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        isUUID: 4
      }
    }
  })

  verification.associate = function (models) {
    models.VerificationToken.belongsTo(models.User, { as: 'user' })
  }

  return verification
}
