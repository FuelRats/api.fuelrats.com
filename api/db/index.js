'use strict'
let Sequelize = require('sequelize')
let config = require('../../config')

if (process.env.NODE_ENV === 'testing') {
  config = config.test
}


let db = new Sequelize(config.postgres.database, config.postgres.username, config.postgres.password, {
  host: config.postgres.hostname,
  port: config.postgres.port,
  dialect: 'postgres'
})

let Rat = db.import(__dirname + '/rat')
let Rescue = db.import(__dirname + '/rescue')
let User = db.import(__dirname + '/user')
let RescueRats = db.import(__dirname + '/rescuerats')
let Client = db.import(__dirname + '/client')

let Code = db.import(__dirname + '/code')
let Token = db.import(__dirname + '/token')
let Action = db.import(__dirname + '/action')
let Reset = db.import(__dirname + '/reset')
let Epic = db.import(__dirname + '/epic')

Rat.belongsTo(User, {
  as: 'user',
  foreignKey: 'UserId'
})
User.hasMany(Rat, { as: 'rats' })


Rescue.belongsToMany(Rat, {
  as: 'rats',
  through: {
    model: RescueRats
  }
})

Rat.belongsToMany(Rescue, {
  as: 'rescues',
  through: {
    model: RescueRats
  }
})

Rat.hasMany(Rescue, { foreignKey: 'firstLimpetId', as: 'firstLimpet' })

Rescue.belongsTo(Rat, {
  as: 'firstLimpet',
  foreignKey: 'firstLimpetId'
})

Client.belongsTo(User, { as: 'user' })
Code.belongsTo(User, { as: 'user' })
Code.belongsTo(Client, { as: 'client' })
Token.belongsTo(User, { as: 'user' })
Token.belongsTo(Client, { as: 'client' })

Action.belongsTo(User, { as: 'user' })

Reset.belongsTo(User, { as: 'user' })

Epic.belongsTo(Rescue, { as: 'rescue' })
Epic.belongsTo(Rat, { as: 'rat' })
Rescue.hasMany(Epic, { foreignKey: 'rescueId', as: 'epics' })
Rat.hasMany(Epic, { foreignKey: 'ratId', as: 'epics' })

User.addScope('defaultScope', {
  attributes: {
    include: [
      [db.cast(db.col('nicknames'), 'text[]'), 'nicknames']
    ],
    exclude: [
      'nicknames'
    ]
  },
  include: [
    {
      model: Rat,
      as: 'rats'
    }
  ]
}, {
  override: true
})

Code.addScope('defaultScope', {
  include: [
    {
      model: User,
      as: 'user',
      required: true
    },
    {
      model: Client,
      as: 'client',
      required: true
    }
  ]
}, {
  override: true
})

Token.addScope('defaultScope', {
  include: [
    {
      model: User,
      as: 'user',
      required: true
    },
    {
      model: Client,
      as: 'client',
      required: true
    }
  ]
}, {
  override: true
})

Client.addScope('defaultScope', {
  include:  [
    {
      model: User,
      as: 'user',
      required: true
    }
  ]
}, {
  override: true
})


module.exports = {
  Action: Action,
  Client: Client,
  Code: Code,
  db: db,
  Rat: Rat,
  Reset: Reset,
  Rescue: Rescue,
  Token: Token,
  User: User,
  RescueRats: RescueRats,
  Epic: Epic
}
