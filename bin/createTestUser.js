'use strict'
process.env.NODE_ENV = 'testing'

let db = require('../api/db').db
let User = require('../api/db').User
let Client = require('../api/db').Client
let Group = require('../api/db').Group
let bcrypt = require('bcrypt')
let fs = require('fs')
let crypto = require('crypto')


db.sync({ force: true }).then(async function () {
  let hash = await bcrypt.hash('testuser', 16)
  let adminTestUser = {
    email: 'admintestuser@fuelrats.com',
    password: hash,
    nicknames: db.literal('ARRAY[\'admintestnick\']::citext[]')
  }

  let adminUser = await User.create(adminTestUser)

  console.log('Admin Test User Created')
  adminUser.addGroup()
  let secret = await crypto.randomBytes(24).toString('hex')

  bcrypt.hash(secret, 16)

  let client = Client.create({
    name: 'API Test Client',
    userId: adminUser.id,
    secret: hash
  })

  fs.writeFile('testinfo.json', JSON.stringify(client.toJSON()), function (err) {
    if (err) {
      return console.log(err)
    }

    console.log('Test data file written')
  })


  let testUser = {
    email: 'testuser@fuelrats.com',
    password: hash,
    nicknames: db.literal('ARRAY[\'testnick\']::citext[]'),
    groups: []
  }

  await User.create(testUser)
  console.log('Test User Created')
})
