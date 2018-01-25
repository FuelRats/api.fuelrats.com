'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('Epics', 'approved')
    queryInterface.addColumn(
      'Epics',
      'approvedById',
      {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null
      }
    )

    queryInterface.addColumn(
      'Epics',
      'nominatedById',
      {
        type: Sequelize.UUID,
        allowNull: true,
        defaultValue: null
      }
    )
  },

  down: (queryInterface, Sequelize) => {
    queryInterface.removeColumn('Epics', 'approvedById')
    queryInterface.removeColumn('Epics', 'nominatedById')
    queryInterface.addColumn(
      'Epics',
      'approved',
      {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }
    )
  }
}
