var _,
    linkRescues,
    moment,
    mongoose,
    normalizePlatform,
    RatSchema,
    Rescue,
    Schema,
    updateRescueCount,
    updateTimestamps,
    winston

_ = require( 'underscore' )
moment = require( 'moment' )
mongoose = require( 'mongoose' )
winston = require( 'winston' )

mongoose.Promise = global.Promise

Rescue = require( './Rescue' )

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





linkRescues = function ( next ) {
  var rat

  rat = this

  rat.rescues = rat.rescues || []

  mongoose.models.Rescue.update({
    unidentifiedRats: rat.CMDRname
  }, {
    $pull: {
      unidentifiedRats: rat.CMDRname
    },
    $push: {
      rats: rat._id
    }
  })
  .then( function () {
    mongoose.models.Rescue.find({
      unidentifiedRats: rat.CMDRname
    })
    .then( function ( rescues ) {
      rescues.forEach( function ( rescue, index, rescues ) {
        this.rescues.push( rescue._id )
      })

      next()
    })
    .catch( next )
  })
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





RatSchema.pre( 'save', updateTimestamps )
RatSchema.pre( 'save', normalizePlatform )
RatSchema.pre( 'save', linkRescues )

RatSchema.pre( 'update', updateTimestamps )

RatSchema.set( 'toJSON', {
  virtuals: true
})

RatSchema.plugin( require( 'mongoosastic' ) )

if ( mongoose.models.Rat ) {
  module.exports = mongoose.model( 'Rat' )
} else {
  module.exports = mongoose.model( 'Rat', RatSchema )
}
