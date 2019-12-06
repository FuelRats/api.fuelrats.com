
import Sequelize from 'sequelize'
import PaperTrail from 'sequelize-paper-trail'
import path from 'path'
import config from '../../config'

const { database, username, password, hostname, port } = config.postgres

const { Op } = Sequelize
const operatorsAliases = {
  eq: Op.eq,
  ne: Op.ne,
  gte: Op.gte,
  gt: Op.gt,
  lte: Op.lte,
  lt: Op.lt,
  not: Op.not,
  in: Op.in,
  notin: Op.notIn,
  is: Op.is,
  like: Op.like,
  notlike: Op.notLike,
  ilike: Op.iLike,
  notilike: Op.notILike,
  $regexp: Op.regexp,
  regexp: Op.regexp,
  notregexp: Op.notRegexp,
  iregexp: Op.iRegexp,
  notiregexp: Op.notIRegexp,
  between: Op.between,
  notbetween: Op.notBetween,
  overlap: Op.overlap,
  contains: Op.contains,
  contained: Op.contained,
  adjacent: Op.adjacent,
  strictleft: Op.strictLeft,
  strictright: Op.strictRight,
  noextendright: Op.noExtendRight,
  noextendleft: Op.noExtendLeft,
  and: Op.and,
  or: Op.or,
  any: Op.any,
  all: Op.all,
  values: Op.values,
  col: Op.col
}

const db = new Sequelize(database, username, password, {
  host: hostname,
  port,
  dialect: 'postgres',
  logging: true,

  pool: {
    idle: 1000,
    min: 0,
    acquire: 30000
  },
  operatorsAliases
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
  'Avatar',
  'User',
  'Rat',
  'Rescue',
  'RescueRats',
  'Client',
  'Code',
  'Token',
  'Reset',
  'Epic',
  'Ship',
  'Decal',
  'Group',
  'UserGroups',
  'VerificationToken',
  'Session'
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
  Sequelize,
  Op
}

export const {
  Rat,
  Rescue,
  User,
  Avatar,
  RescueRats,
  Client,
  Code,
  Token,
  Reset,
  Epic,
  Ship,
  Decal,
  Group,
  UserGroups,
  VerificationToken,
  Session
} = models
