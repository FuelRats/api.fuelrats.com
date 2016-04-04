'use strict'

let _ = require('underscore')
let mongoose = require('mongoose')
let winston = require('winston')
let Rat = require('./rat')

mongoose.Promise = global.Promise

let Schema = mongoose.Schema





let RescueSchema = new Schema({
  active: {
    default: true,
    type: Boolean
  },
  archive: {
    default: false,
    type: Boolean
  },
  client: {
    default: {},
    type: {
      CMDRname: {
        type: String
      },
      nickname: {
        type: String
      }
    }
  },
  codeRed: {
    default: false,
    type: Boolean
  },
  createdAt: {
    type: Date
  },
  epic: {
    default: false,
    type: Boolean
  },
  firstLimpet: {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Rat'
    }]
  },
  lastModified: {
    type: Date
  },
  open: {
    default: true,
    type: Boolean
  },
  name: {
    type: String
  },
  notes: {
    type: String
  },
  platform: {
    default: 'unknown',
    enum: [
      'pc',
      'xb',
      'unknown'
    ],
    type: String
  },
  quotes: {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Quote'
    }]
  },
  rats: {
    default: [],
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Rat'
    }]
  },
  unidentifiedRats: {
    default: [],
    type: [{
      type: String
    }]
  },
  successful: {
    type: Boolean
  },
  system: {
    default: '',
    type: String
  }
}, {
  versionKey: false
})


RescueSchema.index({ unidentifiedRats: 'text' })


let linkRats = function (next) {
  var finds, rescue, updates

  finds = []
  rescue = this
  updates = []

  rescue.rats = rescue.rats || []

  rescue.unidentifiedRats = rescue.unidentifiedRats || []

  rescue.unidentifiedRats.forEach(function (rat) {
    var find

    updates.push(mongoose.models.Rat.update({
      $text: {
        $search: rat.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
        $caseSensitive: false,
        $diacriticSensitive: false
      }
    }, {
      $inc: {
        rescueCount: 1
      },
      $push: {
        rescues: rescue._id
      }
    }))

    find = mongoose.models.Rat.findOne({
      $text: {
        $search: rat.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
        $caseSensitive: false,
        $diacriticSensitive: false
      }
    })

    find.then(function (_rat) {
      if (_rat) {
        rescue.rats.push(_rat._id)
        rescue.unidentifiedRats = _.without(rescue.unidentifiedRats, _rat.CMDRname)
        if(_rat.platform && _rat.platform != null) {
          rescue.platform = _rat.platform
        }
      }
    })

    finds.push(find)
  })

  Promise.all(updates)
  .then(function () {
    Promise.all(finds)
    .then(next)
    .catch(next)
  })
  .catch(next)
}

let normalizePlatform = function (next) {
  this.platform = this.platform.toLowerCase().replace(/^xb\s*1|xbox|xbox1|xbone|xbox\s*one$/g, 'xb')

  next()
}

let updateTimestamps = function (next) {
  var timestamp

  timestamp = new Date()

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
  var rescue = this

  if (rescue.system) {
    rescue.system = rescue.system.trim()
  }

  if (rescue.client) {
    if(rescue.client.CMDRname) {
      rescue.client.CMDRname = rescue.client.CMDRname.trim()
    }

    if(rescue.client.nickname) {
      rescue.client.nickname = rescue.client.nickname.trim()
    }
  }

  if(rescue.unidentifiedRats) {
    for (let i = 0; i < rescue.unidentifiedRats.length; i++) {
      rescue.unidentifiedRats[i] = rescue.unidentifiedRats[i].replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim()
    }
  }

  if(rescue.quotes) {
    for (let i = 0; i < rescue.quotes.length; i++) {
      rescue.quotes[i] = rescue.quotes[i].trim()
    }
  }

  if (rescue.name) {
    rescue.name = rescue.name.trim()
  }

  next()
}

let indexSchema = function (rescue) {
  rescue.index(function () {})
  for (let ratId of rescue.rats) {
    Rat.findById(ratId, function (err, rat) {
      if (err) {
        winston.error(err)
      } else {
        if (rat) {
          rat.save()
        }
      }
    })
  }
}

RescueSchema.pre('save', sanitizeInput)
RescueSchema.pre('save', updateTimestamps)
RescueSchema.pre('save', normalizePlatform)
RescueSchema.pre('save', linkRats)

RescueSchema.pre('update', sanitizeInput)
RescueSchema.pre('update', updateTimestamps)

RescueSchema.plugin(require('mongoosastic'))

RescueSchema.post('save', indexSchema)

RescueSchema.set('toJSON', {
  virtuals: true
})


if (mongoose.models.Rescue) {
  module.exports = mongoose.model('Rescue')
} else {
  module.exports = mongoose.model('Rescue', RescueSchema)
}
