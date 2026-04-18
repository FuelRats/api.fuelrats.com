module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Authenticators', 'recoveryCodes', {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: [],
    })
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('Authenticators', 'recoveryCodes')
  },
}
