module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Rescues', 'carrier', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    })
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('Rescues', 'carrier')
  },
}
