'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Groups', 'jiraRoles', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: [],
    })
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Groups', 'jiraRoles')
  },
}
