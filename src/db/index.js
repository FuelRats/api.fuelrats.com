/* eslint-disable */

import Sequelize from 'sequelize'
import PaperTrail from 'sequelize-paper-trail'
import path from 'path'
import config from '../config'

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
  logging: true,

  pool: {
    idle: 1000,
    min: 0,
    acquire: 30000
  },
  operatorsAliases
})

db.addHook('beforeCount', function (options) {
  if (this._scope.include && this._scope.include.length > 0) {
    options.distinct = true
    options.col = this._scope.col || options.col || `"${this.options.name.singular}".id`
  }

  if (options.include && options.include.length > 0) {
    options.include = undefined
  }
})

/**
 * Import all database models
 * @param {[string]} modelNames the names of the models to import
 * @returns {*}
 */
function importModels (modelNames) {
  const models = modelNames.reduce((modelAcc, modelName) => {
    modelAcc[modelName] = db.import(path.join(__dirname, modelName))
    return modelAcc
  }, {})

  models.db = db
  models.sequelize = db

  Object.keys(models).forEach((modelName) => {
    if (Reflect.has(models[modelName], 'associate')) {
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
