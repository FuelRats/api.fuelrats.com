var autopopulate, moment, mongoose, RatSchema, Rescue, Schema, User, winston

moment = require( 'moment' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )

Rescue = require( './rescue' )
User = require( './user' )

Schema = mongoose.Schema

RatSchema = new Schema({
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
  gamertag: {
    type: String
  },
  lastModified: {
    type: Date
  },
  joined: {
    default: Date.now(),
    type: Date
  },
  nicknames: {
    type: [String]
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
      autopopulate: true,
      type: Schema.Types.ObjectId,
      ref: 'Rescue'
    }]
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  versionKey: false
})

RatSchema.pre( 'save', function ( next ) {
  var timestamp

  // Dealing with timestamps
  timestamp = new Date()

  if ( this.isNew ) {
    this.createdAt = this.createdAt || timestamp
    this.joined = this.joined || timestamp
  }

  this.lastModified = timestamp

  // Dealing with platforms
  this.platform = this.platform.toLowerCase().replace( /^xb\s*1|xbox|xbox1|xbone|xbox\s*one$/g, 'xb' )

  next()
})

RatSchema.set( 'toJSON', {
  virtuals: true
})

autopopulate = function ( next ) {
  this.populate( 'rescues' )
  next()
}

RatSchema.pre( 'find', autopopulate )
RatSchema.pre( 'findOne', autopopulate )

RatSchema.plugin( require( 'mongoosastic' ) )

if ( mongoose.models.Rat ) {
  module.exports = mongoose.model( 'Rat' )
} else {
  module.exports = mongoose.model( 'Rat', RatSchema )
}
