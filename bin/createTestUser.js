'use strict'
process.env.NODE_ENV = 'testing'

let db = require('../api/db').db
let User = require('../api/db').User
let bcrypt = require('bcrypt')
let winston = require('winston')


db.sync({ force: true }).then(function () {
  bcrypt.hash('testuser', 16, function (error, hash) {
    let adminTestUser = {
      email: 'admintestuser@fuelrats.com',
      password: hash,
      nicknames: db.literal('ARRAY[\'admintestnick\']::citext[]'),
      groups: ['rat', 'dispatch', 'admin']
    }

    User.create(adminTestUser).then(function () {
      winston.info('Admin Test User Created')
    }).catch(function (error) {
      winston.error(error)
    })

    let testUser = {
      email: 'testuser@fuelrats.com',
      password: hash,
      nicknames: db.literal('ARRAY[\'testnick\']::citext[]'),
      groups: []
    }

    User.create(testUser).then(function () {
      winston.info('Test User Created')
    }).catch(function (error) {
      winston.error(error)
    })
  })

})
