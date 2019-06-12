'use strict'
const Sequelize = require('sequelize')
let config = require('../../config')

if (process.env.NODE_ENV === 'testing') {
  config = config.test
}

const { Op } = Sequelize
const operatorsAliases = {
  $eq: Op.eq,
  eq: Op.eq,
  $ne: Op.ne,
  ne: Op.ne,
  $gte: Op.gte,
  gte: Op.gte,
  $gt: Op.gt,
  gt: Op.gt,
  $lte: Op.lte,
  lte: Op.lte,
  $lt: Op.lt,
  lt: Op.lt,
  $not: Op.not,
  not: Op.not,
  $in: Op.in,
  in: Op.in,
  $notIn: Op.notIn,
  notin: Op.notIn,
  $is: Op.is,
  is: Op.is,
  $like: Op.like,
  like: Op.like,
  $notLike: Op.notLike,
  notlike: Op.notLike,
  $iLike: Op.iLike,
  ilike: Op.iLike,
  $notILike: Op.notILike,
  notilike: Op.notILike,
  $regexp: Op.regexp,
  regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  notregexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  iregexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  notiregexp: Op.notIRegexp,
  $between: Op.between,
  between: Op.between,
  $notBetween: Op.notBetween,
  notbetween: Op.notBetween,
  $overlap: Op.overlap,
  overlap: Op.overlap,
  $contains: Op.contains,
  contains: Op.contains,
  $contained: Op.contained,
  contained: Op.contained,
  $adjacent: Op.adjacent,
  adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  strictleft: Op.strictLeft,
  $strictRight: Op.strictRight,
  strictright: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  noextendright: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  noextendleft: Op.noExtendLeft,
  $and: Op.and,
  and: Op.and,
  $or: Op.or,
  or: Op.or,
  $any: Op.any,
  any: Op.any,
  $all: Op.all,
  all: Op.all,
  $values: Op.values,
  values: Op.values,
  $col: Op.col,
  col: Op.col
}


let db = new Sequelize(config.postgres.database, config.postgres.username, config.postgres.password, {
  host: config.postgres.hostname,
  port: config.postgres.port,
  dialect: 'postgres',

  pool: {
    idle: 1000,
    min: 0,
    acquire: 30000
  },
  operatorsAliases
})

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
