module.exports = {
  async up (queryInterface, Sequelize) {
    // Add session metadata columns to Tokens
    await queryInterface.addColumn('Tokens', 'ipAddress', {
      type: Sequelize.STRING,
      allowNull: true,
    })
    await queryInterface.addColumn('Tokens', 'userAgent', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
    await queryInterface.addColumn('Tokens', 'authMethod', {
      type: Sequelize.STRING,
      allowNull: true,
    })
    await queryInterface.addColumn('Tokens', 'lastAccess', {
      type: Sequelize.DATE,
      allowNull: true,
    })

    // Migrate data from linked Sessions into Tokens
    await queryInterface.sequelize.query(`
      UPDATE "Tokens" t SET
        "ipAddress" = s.ip::text,
        "userAgent" = s."userAgent",
        "lastAccess" = s."lastAccess"
      FROM "Sessions" s
      WHERE t."sessionId" = s.id
    `)

    // Drop the sessionId FK
    await queryInterface.removeColumn('Tokens', 'sessionId')
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn('Tokens', 'sessionId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'Sessions', key: 'id' },
    })
    await queryInterface.removeColumn('Tokens', 'ipAddress')
    await queryInterface.removeColumn('Tokens', 'userAgent')
    await queryInterface.removeColumn('Tokens', 'authMethod')
    await queryInterface.removeColumn('Tokens', 'lastAccess')
  },
}
