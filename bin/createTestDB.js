'use strict'
process.env.NODE_ENV = 'testing'

// we are deliberately doing all async functions sequentially to aid
// debugging of the process
/* eslint-disable no-await-in-loop */

const logger = require('winston')
// update the logging to go to the console with timestamp
logger.remove(logger.transports.Console)
logger.add(logger.transports.Console, { 
  prettyPrint: true, 
  'timestamp': true, 
  level: 'debug',
  depth: 5
})

const { db, User, Client, Group, Rescue, Rat } = require('../api/db')
const bcrypt = require('bcrypt')
const underscore = require('underscore')

// let fs = require('fs')
// let crypto = require('crypto')
const SECONDS_IN_DAY = 86400
const MILLISECONDS = 1000
const DEFAULT_TIMESPAN = 30
const DEFAULT_START_YEAR = 2017
const DEFAULT_START_MONTH = 6
const DEFAULT_START_DAY = 1
const DEFAULT_PRAND_BIAS = 10000
const BCRYPT_ROUNDS = 12
const ID_PAD_LEN = 3
const MAX_RESCUE_RATS = 3
const SUCCESS_PROBABILITY = 9
const CODE_RED_PROBABILTY = 12
const INACTIVE_PROBABILITY = 20
const SYSTEM_ID_LEN = 2
const RESCUE_DURATION = 900

// seed size of the DB 
const seed = {
  platforms : {
    pc: { rescues: 80, rats: 20 },
    xb: { rescues: 10, rats: 5 },
    ps: { rescues: 10, rats: 5 }
  },
  timespan: DEFAULT_TIMESPAN * SECONDS_IN_DAY * MILLISECONDS,
  start: Date.UTC(DEFAULT_START_YEAR, DEFAULT_START_MONTH, DEFAULT_START_DAY),
  alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
}

/**
 * predictable simple semi psuedo random generator (https://stackoverflow.com/a/19303725/3785845)
 * @param seed the random seed
 * @param bias prand bias factor
 * @returns {Function} a random generator
 */
function prand (seed = 1, bias = DEFAULT_PRAND_BIAS) {
  return function (min, max) {
    if (!max && max !== 0) {
      max = min
      min = 0
    }
    let rand = Math.sin(seed) * bias
    seed += 1
    rand = rand - Math.floor(rand)
    return min + Math.floor(rand * (max - min + 1))
  }
}

// override the underscore random so we can use shuffle and sample
underscore.random = prand()

/**
 * Create a test user
 * @param user user info
 * @returns {Promise.<*>} a test user
 */
async function createUser (user) {

  if (!user.hash) {
    logger.info('creating hash for: %s', user.email)
    user.hash = await bcrypt.hash(user.password, BCRYPT_ROUNDS)
  }

  const nicknames = "ARRAY['" + user.nicknames.join("','") + "']::citext[]"

  logger.info('creating user: %s', user.email)
  const testUser = await User.create({
    email: user.email,
    password: user.hash,
    nicknames: db.literal(nicknames)
  })

  logger.info('adding to %d groups: ', user.groups.length)
  if (user.groups.length) {
    await testUser.addGroups(user.groups)
  }
    
  return testUser
    
}

/**
 * Create a test client
 * @param client client info
 * @returns {Promise.<*>} a test client
 */
async function createClient (client) {

  if (!client.hash) {
    logger.info('creating hash for: %s', client.name)
    client.hash = await bcrypt.hash(client.name, BCRYPT_ROUNDS)
  }

  
  logger.info('creating password for: %s', client.name)
  return Client.create({
    name: client.name,
    userId: client.adminUser,
    secret: client.hash
  })

}

/**
 * Initialize the test
 * @returns {Promise.<void>}
 */
async function init () {

  const group = {}

  try {
    // do the init sequentially to make debugging a little easier
    await db.sync({ force: true })
        
    group.confirmed = await Group.create({
      id: 'confirmed',
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
    })

    group.rat = await Group.create({
      id: 'rat',
      vhost: 'rat.fuelrats.com',
      isAdministrator: false,
      priority: 10,
      permissions: []
    })

    group.dispatch = await Group.create({
      id: 'dispatch',
      vhost: null,
      isAdministrator: false,
      priority: 10,
      permissions: []
    })

    group.overseer = await Group.create({
      id: 'overseer',
      vhost: 'overseer.fuelrats.com',
      isAdministrator: false,
      priority: 50,
      permissions: [
        'rescue.write',
        'rat.write',
        'rescue.delete'
      ]
    })

    group.moderator = await Group.create({
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
    })

    group.netadmin = await Group.create({
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
    })

    group.admin = await Group.create({
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

    const hash = await bcrypt.hash('testuser', BCRYPT_ROUNDS)
    /**
     * Now create the test users that we need to login with
     */
    const adminUser = await createUser({
      email: 'admintestuser@fuelrats.com',
      hash: hash,
      groups: [group.admin, group.rat, group.dispatch],
      nicknames: ['admintestnick']
    })

    /**
     * create rats, clients and rescues for each platform
     */

    for (let plat of Object.keys(seed.platforms)) {

      let size = seed.platforms[plat]
      
      /**
       * create a list of clients
       */

      const clients = []
      const rats = []

      logger.info('creating %d clients for %s', size.rescues, plat)
      for (let client of underscore.range(size.rescues)) {
        let clientName = 'client-' + plat + '-' + String(client).padStart(ID_PAD_LEN, '0')
        clients.push(await createClient({ 
          name: clientName,
          hash: hash,
          adminUser: adminUser.id
        }))
      }

      logger.info('creating %d rats for %s', size.rats, plat)
      for (let rat of underscore.range(size.rats)) {
        let ratName = 'rat-' + plat + '-' + String(rat).padStart(ID_PAD_LEN, '0')
        await createUser({ 
          email: ratName + '@fuelrats.com',
          hash: hash,
          groups: [group.rat],
          nicknames: [ratName]
        }) 
        // create a rat for the user
        rats.push(await Rat.create({ 
          name: ratName,
          platform: plat,
          joined: seed.start
        }))
      }

      logger.info('creating %d rescues for %s', size.rescues, plat)
      for (let rescue of underscore.range(size.rescues)) {
        // get the client

        let outcome = (rescue < MAX_RESCUE_RATS) ? null : underscore.random(SUCCESS_PROBABILITY) ? 'success' : 'failure'
        // create a list of rat indicies we can pull from
        let rescueRats = underscore.sample(rats.map(rat => rat.id), underscore.random(1, MAX_RESCUE_RATS))

        // for(let rat = 0; rat < (rescue % 3) + 1; rat++) {
        //  rescueRats.push(rats[(rescue * rat) % rats.length].id)
        // }

        let createdAt = seed.start.valueOf() + underscore.random(seed.timespan)
        
        const newRescue = await Rescue.create({ 
          client: clients[rescue].name,
          codeRed: underscore.random(CODE_RED_PROBABILTY) !== 0,
          status: outcome ? 'closed' : underscore.random(INACTIVE_PROBABILITY) ? 'closed' : 'inactive',
          system: 'vaguely ' + underscore.sample(seed.alpha, SYSTEM_ID_LEN).join('') 
                  + '-' + underscore.sample(seed.alpha, 1),
          outcome: outcome,
          platform: plat,
          firstLimpetId: outcome === 'success' ? rescueRats[0] : null,
          createdAt: createdAt,
          updatedAt: createdAt + underscore.random(RESCUE_DURATION * MILLISECONDS) // 15 mins
        }, {silent:true})

        await newRescue.addRats(rescueRats) 

      }


    }

  } catch (err) {
    logger.error(err)
  } finally {
    await db.close()
  }

}

init().catch(logger.error)