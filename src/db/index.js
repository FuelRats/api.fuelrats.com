import Sequelize from 'sequelize'
import PaperTrail from 'sequelize-paper-trail'
import config from '../config'
import logger from '../logging'

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
  noIn: Op.notIn,
  is: Op.is,
  like: Op.like,
  notLike: Op.notLike,
  ilike: Op.iLike,
  iLike: Op.iLike,
  notILike: Op.notILike,
  regexp: Op.regexp,
  notRegexp: Op.notRegexp,
  iRegexp: Op.iRegexp,
  notIRegexp: Op.notIRegexp,
  between: Op.between,
  notBetween: Op.notBetween,
  overlap: Op.overlap,
  contains: Op.contains,
  contained: Op.contained,
  adjacent: Op.adjacent,
  strictLeft: Op.strictLeft,
  strictRight: Op.strictRight,
  noExtendRight: Op.noExtendRight,
  noExtendLeft: Op.noExtendLeft,
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
  logging: (message) => {
    logger.info(message)
  },

  pool: {
    idle: 1000,
    min: 0,
    acquire: 30000
  },
  operatorsAliases
})

/* eslint-disable */
db.addHook('beforeCount', function (options) {
  if (this._scope.include && this._scope.include.length > 0) {
    options.distinct = true
    options.col = this._scope.col || options.col || `"${this.options.name.singular}".id`
  }

  if (options.include && options.include.length > 0) {
    options.include = undefined
  }
})
/* eslint-enable */

/**
 * Import database models
 * @param {string} modelNames database model names
 * @returns {Sequelize.Model} database models
 */
function importModels (modelNames) {
  const models = modelNames.reduce((modelAcc, modelName) => {
    // eslint-disable-next-line global-require
    const model = require(`./${modelName}`).default
    model.init(db, Sequelize)
    modelAcc[modelName] = model
    return modelAcc
  }, {})

  Object.keys(models).forEach((modelName) => {
    if (Reflect.has(models[modelName], 'associate')) {
      Reflect.apply(models[modelName].associate, models[modelName], [models])
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
  'EpicUsers',
  'Ship',
  'Decal',
  'Group',
  'UserGroups',
  'VerificationToken',
  'Session'
])


const paperTrail = PaperTrail.init(db, {
  debug: process.env.NODE_ENV !== 'production',
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
