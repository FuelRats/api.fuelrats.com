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

User.hasMany(Rat, { as: 'rats' })
Rescue.belongsToMany(Rat, {
  as: 'rats',
  through: {
    model: RescueRats,
    unique: false
  }
})
Rescue.belongsTo(Rat, { as: 'firstLimpet' })

module.exports = {
  db: db,
  Rat: Rat,
  Rescue: Rescue,
  User: User,
  RescueRats: RescueRats
}
