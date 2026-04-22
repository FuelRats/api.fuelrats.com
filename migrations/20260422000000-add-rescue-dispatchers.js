module.exports = {
  async up (queryInterface, Sequelize) {
    // Create the RescueDispatchers junction table
    await queryInterface.createTable('RescueDispatchers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      rescueId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Rescues', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      assignerUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
      },
      assignerClientId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Clients', key: 'id' },
      },
      temporalPeriod: {
        type: Sequelize.RANGE(Sequelize.DATE),
        defaultValue: [Sequelize.fn('NOW'), null],
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

    // Add indexes for common queries
    await queryInterface.addIndex('RescueDispatchers', ['rescueId'])
    await queryInterface.addIndex('RescueDispatchers', ['userId'])
    await queryInterface.addIndex('RescueDispatchers', ['rescueId', 'userId'], { unique: true })

    // Migrate existing data.dispatchers entries to the new table
    // data.dispatchers is an array of user UUIDs stored in the JSONB data column
    await queryInterface.sequelize.query(`
      INSERT INTO "RescueDispatchers" ("id", "rescueId", "userId", "createdAt", "updatedAt")
      SELECT
        gen_random_uuid(),
        r.id,
        d::uuid,
        r."createdAt",
        r."updatedAt"
      FROM "Rescues" r,
        jsonb_array_elements_text(r.data -> 'dispatchers') AS d
      WHERE r.data ? 'dispatchers'
        AND jsonb_typeof(r.data -> 'dispatchers') = 'array'
        AND jsonb_array_length(r.data -> 'dispatchers') > 0
        AND EXISTS (SELECT 1 FROM "Users" WHERE id = d::uuid)
      ON CONFLICT ("rescueId", "userId") DO NOTHING
    `)

    // Log how many were migrated
    const [[{ count }]] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS count FROM "RescueDispatchers"',
    )
    console.log(`  Migrated ${count} dispatcher assignments from data.dispatchers`)
  },

  async down (queryInterface) {
    await queryInterface.dropTable('RescueDispatchers')
  },
}
