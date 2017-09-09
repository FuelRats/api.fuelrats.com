'use strict'

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Users',
      'groups',
      {
        type: Sequelize.STRING(128),
        allowNull: false,
        defaultValue: []
      }
    )
  },

  down: function (queryInterface) {
    queryInterface.removeColumn('Users', 'groups')
  }
}
