'use strict'
const Sequelize = require('sequelize')
let config = require('../../config')

if (process.env.NODE_ENV === 'testing') {
  config = config.test
}


let db = new Sequelize(config.postgres.database, config.postgres.username, config.postgres.password, {
  host: config.postgres.hostname,
  port: config.postgres.port,
  dialect: 'postgres'
})

db.sync()

let models = {
  db
}

models.Rat = db.import(__dirname + '/rat')
models.Rescue = db.import(__dirname + '/rescue')
models.User = db.import(__dirname + '/user')
models.RescueRats = db.import(__dirname + '/rescuerats')
models.Client = db.import(__dirname + '/client')

models.Code = db.import(__dirname + '/code')
models.Token = db.import(__dirname + '/token')
models.Action = db.import(__dirname + '/action')
models.Reset = db.import(__dirname + '/reset')
models.Epic = db.import(__dirname + '/epic')
models.Ship = db.import(__dirname + '/ship')
models.Decal = db.import(__dirname + '/decal')
models.Group = db.import(__dirname + '/group')
models.UserGroups = db.import(__dirname + '/usergroups')

Object.keys(models).forEach(function (modelName) {
  if (models[modelName].hasOwnProperty('associate')) {
    models[modelName].associate(models)
  }
})

module.exports = models
