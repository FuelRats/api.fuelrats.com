'use strict'
let Sequelize = require('sequelize')

let db = new Sequelize('fuelrats', 'alex', 'fuelrats', {
  host: 'localhost',
  dialect: 'postgres'
})

let Rat = db.import(__dirname + '/rat')
let Rescue = db.import(__dirname + '/rescue')
let User = db.import(__dirname + '/user')
let RescueRats = db.import(__dirname + '/rescuerats')
let Client = db.import(__dirname + '/client')

let Code = db.import(__dirname + '/code')
let Token = db.import(__dirname + '/token')

User.hasMany(Rat, { as: 'rats' })
Rescue.belongsToMany(Rat, {
  as: 'rats',
  through: {
    model: RescueRats,
    unique: false
  }
})

Rescue.belongsTo(Rat, {
  as: 'firstLimpet'
})

Client.belongsTo(User, { as: 'user' })
Code.belongsTo(User, { as: 'user' })
Code.belongsTo(Client, { as: 'client' })
Token.belongsTo(User, { as: 'user' })
Token.belongsTo(Client, { as: 'client' })

module.exports = {
  Client: Client,
  Code: Code,
  db: db,
  Rat: Rat,
  Rescue: Rescue,
  Token: Token,
  User: User,
  RescueRats: RescueRats
}
