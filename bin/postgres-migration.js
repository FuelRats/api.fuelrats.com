'use strict'

let winston = require('winston')
let mongoRat = require('../api/models/rat')
let mongoRescue = require('../api/models/rescue')
let mongoUser = require('../api/models/user')
let mongoose = require('mongoose')
let db = require('../api/db').db
let Rat = require('../api/db').Rat
let Rescue = require('../api/db').Rescue
let User = require('../api/db').User

mongoose.connect('mongodb://localhost:9001/fuelrats')

db.sync({ force: true }).then(function () {
  migrateRats()
})


/* These tables will correlate the MongoDB id keys with the new Postgres primary
keys, so we will be easily able to migrate all the rats first and then add them
to rescues afterwards */
let rats = {}

function migrateRats () {
  rats = {}
  mongoRat.find({}).exec().then(function (mongoRats) {
    for (let mongoRat of mongoRats) {
      (function (mongoRat) {
        Rat.create({
          CMDRname: mongoRat.CMDRname,
          createdAt: mongoRat.createdAt,
          joined: mongoRat.joined,
          platform: mongoRat.platform
        }).then(function (rat) {
          rats[mongoRat._id] = rat
          if (Object.keys(rats).length === mongoRats.length) {
            migrateUsers()
            migrateRescues()
          }
        })
      })(mongoRat)
    }
  }, function (error) {
    winston.error(error)
  })
}

function migrateUsers () {
  mongoUser.find({}).exec().then(function (mongoUsers) {
    for (let mongoUser of mongoUsers) {
      (function (mongoUser) {
        User.create({
          email: mongoUser.email,
          password: mongoUser.hash,
          salt: mongoUser.salt,
          drilled: false,
          drilledDispatch: false,
          group: mongoUser.group || 'normal'
        }).then(function (user) {
          for (let mongoRat of mongoUser.CMDRs) {
            let rat = rats[mongoRat._id]
            if (rat) {
              user.addRat(rat)
            }
          }
        })
      })(mongoUser.toObject())
    }
  })
}

function migrateRescues () {
  mongoRescue.find({}) .exec().then(function (mongoRescues) {
    for (let mongoRescue of mongoRescues) {
      (function (mongoRescue) {
        Rescue.create({
          codeRed: mongoRescue.codeRed,
          createdAt: mongoRescue.createdAt,
          epic: mongoRescue.epic,
          open: false,
          notes: mongoRescue.notes,
          quotes: [],
          platform: mongoRescue.platform,
          successful: mongoRescue.successful,
          system: mongoRescue.system
        }).then(function (rescue) {
          let firstLimpetRat = rats[mongoRescue.firstLimpet]
          if (firstLimpetRat) {
            rescue.setFirstLimpet(firstLimpetRat)
          }

          for (let mongoRat of mongoRescue.rats) {
            let rat = rats[mongoRat]
            if (rat) {
              rescue.addRat(rat)
            }
          }
        })
      })(mongoRescue)
    }
  })
}
