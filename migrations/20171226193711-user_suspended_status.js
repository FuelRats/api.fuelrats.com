'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.addColumn(
      'Users',
      'status',
      {
        type: Sequelize.ENUM('active', 'inactive', 'legacy'),
        allowNull: false,
        defaultValue: 'unconfirmed'
      }
    )

    queryInterface.addColumn(
      'Users',
      'suspended',
      {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('Users', 'status')
    queryInterface.removeColumn('Users', 'suspended')
  }
}