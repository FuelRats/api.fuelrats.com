'use strict'

let winston = require('winston')
let Rat = require('../api/models/rat')
let Rescue = require('../api/models/rescue')
let User = require('../api/models/user')
let mongoose = require('mongoose')

mongoose.connect('mongodb://localhost/fuelrats')

winston.info('Beginning Index Model Sync')
winston.info('Syncing Rats')
Rat.synchronize()

winston.info('Syncing Rescue')
Rescue.synchronize()

winston.info('Syncing User')
User.synchronize()
winston.info('Index sync complete')
