'use strict'

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Clients',
      'redirectUri',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    )
  },

  down: function (queryInterface) {
    queryInterface.removeColumn('Clients', 'redirectUri')
  }
}
