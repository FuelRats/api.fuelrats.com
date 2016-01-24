var moment, mongoose, RescueSchema, Schema, winston

moment = require( 'moment' )
mongoose = require( 'mongoose' )
mongoosastic = require( 'mongoosastic' )
winston = require( 'winston' )

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

RescueSchema.index({
  'CMDRname': 'text',
  'nickname': 'text'
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
