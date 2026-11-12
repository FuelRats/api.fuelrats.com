'use strict'

// Tokens issued to public OAuth clients expire; bearer authentication rejects them once
// expiresAt has passed. Null means the token does not expire (all other clients).

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Tokens', 'expiresAt', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Tokens', 'expiresAt')
  },
}
