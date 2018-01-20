'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.addColumn(
      'Epics',
      'approved',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    )
    queryInterface.addColumn(
      'Epics',
      'deletedAt',
      {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('Epics', 'approved')
    queryInterface.removeColumn('Epics', 'deletedAt')
  }
}
