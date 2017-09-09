'use strict'

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'Rescues',
      'type',
      {
        type: Sequelize.ENUM('success', 'failure', 'invalid', 'other'),
        allowNull: false,
        defaultValue: 'other'
      }
    )


    queryInterface.addColumn(
      'Rescues',
      'status',
      {
        type: Sequelize.ENUM('open', 'inactive', 'closed'),
        allowNull: false,
        defaultValue: 'open'
      }
    )
  },

  down: function (queryInterface) {
    queryInterface.removeColumn('Rescues', 'type')
    queryInterface.removeColumn('Rescues', 'status')
  }
}
