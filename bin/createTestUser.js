'use strict'
process.env.NODE_ENV = 'testing'

let db = require('../api/db').db
let User = require('../api/db').User
let bcrypt = require('bcrypt')
let winston = require('winston')


db.sync({ force: true }).then(function () {
  bcrypt.hash('testuser', 16, function (error, hash) {
    let testUser = {
      email: 'support@fuelrats.com',
      password: hash,
      drilled: true,
      drilledDispatch: true,
      nicknames: db.literal('ARRAY[\'testnick\']::citext'),
      group: 'admin'
    }

    User.create(testUser).then(function () {
      winston.info('Test User Created')
    }).catch(function (error) {
      winston.error(error)
    })
  })

})
