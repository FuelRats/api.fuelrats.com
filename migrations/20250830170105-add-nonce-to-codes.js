'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Codes', 'nonce', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Codes', 'nonce')
  },
}
