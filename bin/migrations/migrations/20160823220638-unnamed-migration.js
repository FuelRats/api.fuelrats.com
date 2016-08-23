'use strict'

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Users',
      'dispatch',
      {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: null,
        unique: true
      }
    )
  },

  down: function (queryInterface) {
    queryInterface.removeColumn('Users', 'dispatch')
  }
}
