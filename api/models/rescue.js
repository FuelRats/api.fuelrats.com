var _,
    linkRats,
    moment,
    mongoose,
    normalizePlatform,
    Rat,
    RescueSchema,
    Schema,
    updateTimestamps,
    winston

_ = require( 'underscore' )
moment = require( 'moment' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )

mongoose.Promise = global.Promise

Rat = require( './rat' )

Schema = mongoose.Schema





RescueSchema = new Schema({
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
    default: 'pc',
    enum: [
      'pc',
      'xb'
    ],
    type: String
  },
  quotes: {
    type: [{
      type: String
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
    type: String
  }
}, {
  versionKey: false
})





linkRats = function ( next ) {
  var finds, rescue, updates

  finds = []
  rescue = this
  updates = []

  rescue.rats = rescue.rats || []
  rescue.unidentifiedRats = rescue.unidentifiedRats || []

  rescue.unidentifiedRats.forEach( function ( rat, index, rats ) {
    var find
    updates.push( mongoose.models.Rat.update({
      CMDRname: rat
    }, {
      $inc: {
        rescueCount: 1
      },
      $push: {
        rescues: rescue._id
      }
    }))

    find = mongoose.models.Rat.findOne({
      CMDRname: rat
    })

    find.then( function ( _rat ) {
      if ( _rat ) {
        rescue.rats.push( _rat._id )
        rescue.unidentifiedRats = _.without( rescue.unidentifiedRats, _rat.CMDRname )
      }
    })

    finds.push( find )
  })

  Promise.all( updates )
  .then( function () {
    Promise.all( finds )
    .then( next )
    .catch( next )
  })
  .catch( next )
}

normalizePlatform = function ( next ) {
  this.platform = this.platform.toLowerCase().replace( /^xb\s*1|xbox|xbox1|xbone|xbox\s*one$/g, 'xb' )

  next()
}

updateTimestamps = function ( next ) {
  var timestamp

  timestamp = new Date()

  if ( !this.open ) {
    this.active = false
  }

  if ( this.isNew ) {
    this.createdAt = this.createdAt || timestamp
  }

  this.lastModified = timestamp

  next()
}


sanitizeInput = function ( next ) {
    var rescue = this

    if(rescue.system)
        rescue.system = rescue.system.trim()

    if(rescue.client)
    {
        if(rescue.client.CMDRname)
            rescue.client.CMDRname = rescue.client.CMDRname.trim()
        if(rescue.client.nickname)
            rescue.client.nickname = rescue.client.nickname.trim()
    }

    if(rescue.unidentifiedRats)
    {
        for(var i = 0; i < rescue.unidentifiedRats.length; i++)
        {
            rescue.unidentifiedRats[i] = rescue.unidentifiedRats[i].trim()
        }
    }

    if(rescue.quotes)
    {
        for(var i = 0; i < rescue.quotes.length; i++)
        {
            rescue.quotes[i] = rescue.quotes[i].trim()
        }
    }

    if(rescue.name)
        rescue.name = rescue.name.trim()
    next()
}


RescueSchema.pre( 'save', sanitizeInput )
RescueSchema.pre( 'save', updateTimestamps )
RescueSchema.pre( 'save', normalizePlatform )
RescueSchema.pre( 'save', linkRats )

RescueSchema.pre( 'update', sanitizeInput )
RescueSchema.pre( 'update', updateTimestamps )

RescueSchema.set( 'toJSON', {
  virtuals: true
})

RescueSchema.plugin( require( 'mongoosastic' ) )

if ( mongoose.models.Rescue ) {
  module.exports = mongoose.model( 'Rescue' )
} else {
  module.exports = mongoose.model( 'Rescue', RescueSchema )
}

module.exports.synchronize()
