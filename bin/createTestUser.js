'use strict'
process.env.NODE_ENV = 'testing'

let db = require('../api/db').db
let User = require('../api/db').User
let Client = require('../api/db').Client
let bcrypt = require('bcrypt')
let winston = require('winston')
let fs = require('fs')
let crypto = require('crypto')


db.sync({ force: true }).then(function () {
  bcrypt.hash('testuser', 16, function (error, hash) {
    let adminTestUser = {
      email: 'admintestuser@fuelrats.com',
      password: hash,
      nicknames: db.literal('ARRAY[\'admintestnick\']::citext[]'),
      groups: ['rat', 'dispatch', 'admin']
    }

    User.create(adminTestUser).then(function (adminUser) {
      winston.info('Admin Test User Created')

      let secret = crypto.randomBytes(24).toString('hex')

      bcrypt.hash(secret, 16, function (error, hash) {
        if (error) {
          return winston.error(error)
        }

        Client.create({
          name: 'API Test Client',
          userId: adminUser.id,
          secret: hash
        }).then(function (client) {
          client.secret = secret
          fs.writeFile('testinfo.json', JSON.stringify(client.toJSON()), function (err) {
            if (err) {
              return winston.error(err)
            }

            winston.info('Test data file written')
          })
        }).catch(function (error) {
          winston.error(error)
        })
      })
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
