'use strict'

module.exports = function (sequelize, DataTypes) {
  return sequelize.define('Order', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amountReturned: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'eur'
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    items: {
      type: DataTypes.ARRAY(DataTypes.JSONB),
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    shipping: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('created', 'paid', 'canceled', 'fulfilled', 'returned')
    }
  })
}
