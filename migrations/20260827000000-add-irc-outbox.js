module.exports = {
  async up (queryInterface, Sequelize) {
    // Durable at-least-once delivery queue for NickServ GROUPSYNC push-triggers.
    await queryInterface.createTable('IrcOutboxes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'delivered', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      nextRetryAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      lastError: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    })

    // Coalesce bursts: at most one pending delivery per email.
    await queryInterface.addIndex('IrcOutboxes', ['email'], {
      unique: true,
      name: 'irc_outbox_pending_email',
      where: { status: 'pending' },
    })

    // The worker's claim query orders by (status, nextRetryAt).
    await queryInterface.addIndex('IrcOutboxes', ['status', 'nextRetryAt'])
  },

  async down (queryInterface) {
    await queryInterface.dropTable('IrcOutboxes')
  },
}
