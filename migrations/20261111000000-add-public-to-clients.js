'use strict'

// Public OAuth clients (browser apps that cannot keep a secret) authenticate at the token
// endpoint with their client_id alone and must use PKCE. The secret column stays NOT NULL;
// a public client still has a generated secret, it is just never required.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Clients', 'public', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Clients', 'public')
  },
}
