var mongoose, RescueSchema, Schema;

mongoose = require( 'mongoose' );
Schema = mongoose.Schema;

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
    type: Number
  },
  epic: {
    default: false,
    type: Boolean
  },
  lastModified: {
    type: Number
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
});

RescueSchema.index({
  'CMDRname': 'text',
  'nickname': 'text'
});

RescueSchema.pre( 'save', function ( next ) {
  var timestamp;

  timestamp = parseInt( new Date().getTime() / 1000 );

  if ( !this.open ) {
    this.active = false;
  }

  this.createdAt = this.createdAt || timestamp;
  this.lastModified = timestamp;

  next();
});

//RescueSchema.index( { '$**': 'text' } );
RescueSchema.set( 'toJSON', {
  virtuals: true,
  transform: function ( document, ret, options ) {
    ret.id = document._id;
    delete ret._id;
  }
});

module.exports = mongoose.model( 'Rescue', RescueSchema );
