'use strict'

// PKCE (RFC 7636): the code challenge sent to /oauth2/authorize is stored with the
// authorization code and checked against the code_verifier at /oauth2/token.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Codes', 'codeChallenge', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
    await queryInterface.addColumn('Codes', 'codeChallengeMethod', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Codes', 'codeChallengeMethod')
    await queryInterface.removeColumn('Codes', 'codeChallenge')
  },
}
