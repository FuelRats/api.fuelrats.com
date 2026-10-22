'use strict'

// Enforce a case-insensitive unique email across active users. Email is the account identity and
// the key Anope operations use, so duplicates allowed one member to collide with another's address
// and take over their IRC account. Soft-deleted users (deletedAt set) are excluded so a freed
// address can be reused. Fails loudly if existing active duplicates are present; resolve those first.

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_lower_active_unique"
      ON "Users" (lower(email))
      WHERE "deletedAt" IS NULL
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "Users_email_lower_active_unique"')
  },
}
