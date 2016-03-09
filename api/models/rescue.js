'use strict'

let _ = require('underscore')
let moment = require('moment')
let mongoose = require('mongoose')
let winston = require('winston')

mongoose.Promise = global.Promise

let Quote = require('./quote')
let Rat = require('./rat')

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
    type: {
      type: Schema.Types.ObjectId,
      ref: 'Rat'
    }
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





RescueSchema.index({
  unidentifiedRats: 'text'
})





let checkRat = function (rat) {

}

let linkRats = function (next) {
  let finds = []
  let rescue = this
  let updates = []

  rescue.rats = rescue.rats || []
  rescue.unidentifiedRats = rescue.unidentifiedRats || []

  rescue.unidentifiedRats.forEach(function (rat, index, rats) {
    updates.push(mongoose.models.Rat.update(
      {
        $text: {
          $search: rat.replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim(),
          $caseSensitive: false,
          $diacriticSensitive: false
        }
      },
      {
        $inc: {
          successfulAssistCount: 1,
          rescueCount: 1
        },
        $push: {
          rescues: rescue._id
        }
      }
    ))

    let find = mongoose.models.Rat.findOne({
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
        if (_rat.platform && _rat.platform != null) {
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
  let rescue = this

  if (rescue.system) {
    rescue.system = rescue.system.trim()
  }

  if (rescue.client) {
    if (rescue.client.CMDRname) {
      rescue.client.CMDRname = rescue.client.CMDRname.trim()
    }
    if (rescue.client.nickname) {
      rescue.client.nickname = rescue.client.nickname.trim()
    }
  }

  if (rescue.unidentifiedRats) {
    for (let i = 0; i < rescue.unidentifiedRats.length; i++) {
      rescue.unidentifiedRats[i] = rescue.unidentifiedRats[i].replace(/cmdr /i, '').replace(/\s\s+/g, ' ').trim()
    }
  }

  if (rescue.quotes) {
    for(let i = 0; i < rescue.quotes.length; i++) {
      rescue.quotes[i] = rescue.quotes[i].trim()
    }
  }

  if (rescue.name) {
    rescue.name = rescue.name.trim()
  }

  next()
}

let synchronize = function (rescue) {
  rescue.index(function (error, response) {
    if (error) {
      winston.error(error)
    }
  })
}





RescueSchema.pre('save', sanitizeInput)
RescueSchema.pre('save', updateTimestamps)
RescueSchema.pre('save', normalizePlatform)
RescueSchema.pre('save', linkRats)

RescueSchema.pre('update', sanitizeInput)
RescueSchema.pre('update', updateTimestamps)

RescueSchema.post('save', synchronize)

RescueSchema.post('update', synchronize)

RescueSchema.set('toJSON', {
  virtuals: true
})

RescueSchema.plugin(require('mongoosastic'))

if (mongoose.models.Rescue) {
  module.exports = mongoose.model('Rescue')
} else {
  module.exports = mongoose.model('Rescue', RescueSchema)
}
