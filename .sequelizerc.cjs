const path = require('path')

module.exports = {
  'config': path.resolve('database.json'),
  'models-path': path.resolve('db',),
  'seeders-path': path.resolve('seeders'),
  'migrations-path': path.resolve('migrations')
}
