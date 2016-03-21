'use strict'

let mongoose = require('mongoose')
let winston = require('winston')

mongoose.Promise = global.Promise

let Schema = mongoose.Schema





let RatSchema = new Schema({
  archive: {
    default: false,
    type: Boolean
  },
  CMDRname: {
    type: String
  },
  createdAt: {
    type: Date
  },
  data: {
    default: {},
    type: Schema.Types.Mixed
  },
  failedAssistCount: {
    default: 0,
    type: Number
  },
  failedRescueCount: {
    default: 0,
    type: Number
  },
  lastModified: {
    type: Date
  },
  joined: {
    default: Date.now(),
    type: Date
  },
  nicknames: {
    default: [],
    type: [{
      type: String
    }]
  },
  platform: {
    default: 'pc',
    enum: [
      'pc',
      'xb'
    ],
    type: String
  },
  rescues: {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Rescue'
    }]
  },
  rescueCount: {
    default: 0,
    index: true,
    type: Number
  },
  successfulAssistCount: {
    default: 0,
    type: Number
  },
  successfulRescueCount: {
    default: 0,
    type: Number
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  versionKey: false
})





let normalizePlatform = function (next) {
  this.platform = this.platform.toLowerCase().replace(/^xb\s*1|xbox|xbox1|xbone|xbox\s*one$/g, 'xb')

  next()
}

let updateTimestamps = function (next) {
  let timestamp = new Date()

  if (!this.open) {
    this.active = false
  }

  if (this.isNew) {
    this.createdAt = this.createdAt || timestamp
  }

  this.lastModified = timestamp

  next()
}

let sanitizeInput = function (next) {
  let rat = this
  if (rat && rat.CMDRname) {
    rat.CMDRname = rat.CMDRname.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim()
  }
  next()
}

let indexSchema = function (rat) {
  rat.index(function (error) {
    if (error) {
      winston.error(error)
    }
  })
}





RatSchema.pre('save', sanitizeInput)
RatSchema.pre('save', updateTimestamps)
RatSchema.pre('save', normalizePlatform)

RatSchema.pre('update', sanitizeInput)
RatSchema.pre('update', updateTimestamps)

RatSchema.plugin(require('mongoosastic'))

RatSchema.post('save', indexSchema)

RatSchema.set('toJSON', {
  virtuals: true
})

RatSchema.index({
  CMDRname: 'text'
})

if (mongoose.models.Rat) {
  module.exports = mongoose.model('Rat')
} else {
  module.exports = mongoose.model('Rat', RatSchema)
}
