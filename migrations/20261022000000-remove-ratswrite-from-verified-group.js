'use strict'

// Removes the rat-admin permission `rats.write` from the `verified` group (every confirmed user),
// which let any member reassign, rename, delete, or transfer anyone's rats. Members keep
// `rats.write.me` for their own rats. Also drops `groups.write.me`, which is not a real permission
// and would be rejected by scope validation on the next group save. Only the `verified` group is
// touched; rat-admin groups (overseer/admin/techrat) keep `rats.write`.

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Groups"
      SET permissions = array_remove(array_remove(permissions, 'rats.write'), 'groups.write.me')
      WHERE name = 'verified'
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Groups"
      SET permissions = ARRAY(
        SELECT DISTINCT unnest(permissions || ARRAY['rats.write', 'groups.write.me']::varchar[])
      )
      WHERE name = 'verified'
    `)
  },
}
