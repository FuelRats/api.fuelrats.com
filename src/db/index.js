
import Sequelize from 'sequelize'
import PaperTrail from 'sequelize-paper-trail-fr'
import path from 'path'
import config from '../../config'

const { database, username, password, hostname, port } = config.postgres

const db = new Sequelize(database, username, password, {
  host: hostname,
  port,
  dialect: 'postgres',
  logging: true,

  pool: {
    idle: 10000
  }
})

/**
 * Import all database models
 * @param modelNames the names of the models to import
 * @returns {*}
 */
function importModels (modelNames) {
  const models = modelNames.reduce((modelAcc, modelName) => {
    modelAcc[modelName] = db.import(path.join(__dirname, modelName.toLowerCase()))
    return modelAcc
  }, {})

  models.db = db
  models.sequelize = db

  Object.keys(models).forEach((modelName) => {
    if (models[modelName].hasOwnProperty('associate')) {
      models[modelName].associate(models)
    }
  })
  return models
}


const models = importModels([
  'Rat',
  'npoMembership',
  'Rescue',
  'User',
  'RescueRats',
  'Client',
  'Code',
  'Token',
  'Action',
  'Reset',
  'Epic',
  'Ship',
  'Decal',
  'Group',
  'UserGroups'
])


const paperTrail = PaperTrail.init(db, {
  debug: true,
  userModel: 'User',
  exclude: [
    'createdAt',
    'updatedAt'
  ],
  enableMigration: true,
  enableRevisionChangeModel: true,
  UUID: true,
  continuationKey: 'userId'
})
paperTrail.defineModels({})

models.Rescue.Revisions = models.Rescue.hasPaperTrail()

export {
  db,
  db as sequelize,
  Sequelize
}

export const {
  Rat,
  npoMembership,
  Rescue,
  User,
  RescueRats,
  Client,
  Code,
  Token,
  Action,
  Reset,
  Epic,
  Ship,
  Decal,
  Group,
  UserGroups
} = models
