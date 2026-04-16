module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Tokens', 'sessionId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Sessions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    })
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('Tokens', 'sessionId')
  },
}
