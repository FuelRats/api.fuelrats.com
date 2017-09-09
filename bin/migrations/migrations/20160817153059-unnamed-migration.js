'use strict'

module.exports = {
  up: function (queryInterface, Sequelize, done) {
    queryInterface.addIndex(
      'Rescues', ['data'],
      {
        fields: ['data'],
        using: 'GIN',
        operator: 'jsonb_path_ops'
      }
    )
    done()
  }
}
