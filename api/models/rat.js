'use strict'

let mongoose = require('mongoose')

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
  drilled: {
    default: {
      dispatch: false,
      rescue: false
    },
    type: {
      dispatch: {
        type: Boolean
      },
      rescue: {
        type: Boolean
      }
    }
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
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  versionKey: false
})


RatSchema.index({
  CMDRname: 'text'
})


let linkRescues = function (next) {
  var rat

  rat = this

  rat.rescues = []

  mongoose.models.Rescue.update({
    $text: {
      $search: rat.CMDRname.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
      $caseSensitive: false,
      $diacriticSensitive: false
    }
  }, {
    $set: {
      platform: rat.platform
    },
    $pull: {
      unidentifiedRats: rat.CMDRname.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim()
    },
    $push: {
      rats: rat._id
    }
  })
  .then(function () {
    mongoose.models.Rescue.find({
      rats: rat._id
    }).then(function (rescues) {
      rescues.forEach(function (rescue) {
        rat.rescues.push(rescue._id)
      })
      if (rat.rescues) {
        rat.rescueCount = rat.rescues.length
      } else {
        rat.rescueCount = 0
      }
      next()
    }).catch(next)
  })
}



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




RatSchema.pre('save', sanitizeInput)
RatSchema.pre('save', updateTimestamps)
RatSchema.pre('save', normalizePlatform)
RatSchema.pre('save', linkRescues)

RatSchema.pre('update', sanitizeInput)
RatSchema.pre('update', updateTimestamps)

RatSchema.set('toJSON', {
  virtuals: true
})

RatSchema.plugin(require('mongoosastic'))

if (mongoose.models.Rat) {
  module.exports = mongoose.model('Rat')
} else {
  module.exports = mongoose.model('Rat', RatSchema)
}
