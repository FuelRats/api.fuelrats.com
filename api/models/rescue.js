var moment, mongoose, Rat, RescueSchema, Schema, winston

moment = require( 'moment' )
mongoose = require( 'mongoose' )
mongoosastic = require( 'mongoosastic' )
winston = require( 'winston' )

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
    type: 'Moment'
  },
  epic: {
    default: false,
    type: Boolean
  },
  lastModified: {
    type: 'Moment'
  },
  open: {
    default: true,
    type: Boolean
  },
  notes: {
    type: String
  },
  platform: {
    default: 'PC',
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
  tempRats: {
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
})

RescueSchema.pre( 'save', function ( next ) {
  var timestamp

  timestamp = new moment

  if ( !this.open ) {
    this.active = false
  }

  if ( this.isNew ) {
    this.createdAt = this.createdAt || timestamp
  }

  this.lastModified = timestamp

  next()
})

RescueSchema.post( 'init', function ( doc ) {
  doc.createdAt = doc.createdAt.valueOf()
  doc.lastModified = doc.lastModified.valueOf()
})

RescueSchema.set( 'toJSON', {
  virtuals: true
})

RescueSchema.plugin( mongoosastic )

if ( mongoose.models.Rescue ) {
  module.exports = mongoose.model( 'Rescue' )
} else {
  module.exports = mongoose.model( 'Rescue', RescueSchema )
}
