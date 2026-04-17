const displayNames = {
  verified: 'Verified',
  developer: 'Developer',
  rat: 'Drilled Rat',
  dispatch: 'Drilled Dispatch',
  trainer: 'Trainer',
  traineradmin: 'Training Manager',
  merch: 'Merch',
  overseer: 'Overseer',
  techrat: 'Tech Rat',
  moderator: 'Moderator',
  operations: 'Operations Team',
  netadmin: 'Network Administrator',
  admin: 'Network Moderator',
  owner: 'Special Snowflake',
  storeadmin: 'Store Admin',
  merchant: 'Quartermaster',
}

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Groups', 'displayName', {
      type: Sequelize.STRING,
      allowNull: true,
    })

    for (const [name, displayName] of Object.entries(displayNames)) {
      await queryInterface.sequelize.query(
        'UPDATE "Groups" SET "displayName" = :displayName WHERE "name" = :name',
        { replacements: { displayName, name } },
      )
    }
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('Groups', 'displayName')
  },
}
