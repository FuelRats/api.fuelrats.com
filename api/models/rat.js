var mongoose, RatSchema, Schema;

mongoose = require( 'mongoose' );
Rescue = require( './rescue' );
Schema = mongoose.Schema;

RatSchema = new Schema({
  'archive': {
    default: false,
    type: Boolean
  },
  'CMDRname': {
    type: String
  },
  'createdAt': {
    type: Number
  },
  'drilled': {
    default: false,
    type: Boolean
  },
  'gamertag': {
    type: String
  },
  'lastModified': {
    type: Number
  },
  'joined': {
    default: Date.now(),
    type: Number
  },
  'netlog': {
    type: {
      'commanderId': {
        type: String
      },
      'data': {
        type: Schema.Types.Mixed
      },
      'userId': {
        type: String
      }
    }
  },
  'nicknames': {
    type: [String]
  },
  'rescues': {
    type: [{
      type: Schema.Types.ObjectId,
      ref: 'Rescue'
    }]
  }
});

RatSchema.index({
  'CMDRname': 'text',
  'gamertag': 'text',
  'nickname': 'text'
});

RatSchema.pre( 'save', function ( next ) {
  var timestamp;

  timestamp = parseInt( new Date().getTime() / 1000 );

  this.createdAt = this.createdAt || timestamp;
  this.joined = this.joined || timestamp;
  this.lastModified = timestamp;

  next();
});

RatSchema.set( 'toJSON', {
  virtuals: true,
  transform: function ( document, ret, options ) {
    ret.id = ret._id;
    delete ret._id;
  }
});

module.exports = mongoose.model( 'Rat', RatSchema );
