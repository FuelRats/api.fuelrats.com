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
  let groups = [
    Group.create({
      id: 'default',
      vhost: 'recruit.fuelrats.com',
      isAdministrator: false,
      priority: 0,
      permissions: [
        'rescue.read',
        'rescue.read.me',
        'rescue.write.me',
        'rat.read',
        'rat.write.me',
        'client.read.me',
        'client.write.me',
        'client.delete.me',
        'user.read.me',
        'user.write.me'
      ]
    }),

    Group.create({
      id: 'rat',
      vhost: 'rat.fuelrats.com',
      isAdministrator: false,
      priority: 10,
      permissions: []
    }),

    Group.create({
      id: 'dispatch',
      vhost: null,
      isAdministrator: false,
      priority: 10,
      permissions: []
    }),

    Group.create({
      id: 'overseer',
      vhost: 'overseer.fuelrats.com',
      isAdministrator: false,
      priority: 50,
      permissions: [
        'rescue.write',
        'rat.write',
        'rescue.delete'
      ]
    }),

    Group.create({
      id: 'moderator',
      vhost: 'op.fuelrats.com',
      isAdministrator: false,
      priority: 90,
      permissions: [
        'rescue.write',
        'rat.write',
        'user.read',
        'user.write',
        'client.read',
        'rescue.delete'
      ]
    }),

    Group.create({
      id: 'netadmin',
      vhost: 'netadmin.fuelrats.com',
      isAdministrator: true,
      priority: 100,
      permissions: [
        'user.read',
        'rescue.read',
        'rescue.write',
        'rescue.delete',
        'rat.read',
        'rat.write',
        'rat.delete',
        'user.read',
        'user.write',
        'user.delete',
        'user.groups',
        'client.read',
        'client.write',
        'client.delete'
      ]
    }),

    Group.create({
      id: 'admin',
      vhost: 'admin.fuelrats.com',
      isAdministrator: true,
      priority: 100,
      permissions: [
        'user.read',
        'rescue.read',
        'rescue.write',
        'rescue.delete',
        'rat.read',
        'rat.write',
        'rat.delete',
        'user.read',
        'user.write',
        'user.delete',
        'user.groups',
        'client.read',
        'client.write',
        'client.delete'
      ]
    })
  ]

  await Promise.all(groups)
  console.log('User Groups Created')


  let adminGroup = await Group.findById('admin')
  let ratGroup = await Group.findById('rat')
  let dispatchGroup = await Group.findById('dispatch')

  let hash = await bcrypt.hash('testuser', 16)
  let adminTestUser = {
    email: 'admintestuser@fuelrats.com',
    password: hash,
    nicknames: db.literal('ARRAY[\'admintestnick\']::citext[]')
  }

  let adminUser = await User.create(adminTestUser)
  adminUser.addGroups([adminGroup, ratGroup, dispatchGroup])

  console.log('Admin Test User Created')
  let secret = await crypto.randomBytes(24).toString('hex')

  bcrypt.hash(secret, 16)

  let client = await Client.create({
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
    nicknames: db.literal('ARRAY[\'testnick\']::citext[]')
  }

  await User.create(testUser)
  console.log('Test User Created')

})
