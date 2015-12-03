var mongoose, RatSchema, Schema;

mongoose = require( 'mongoose' );
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
    type: Date
  },
  'drilled': {
    default: false,
    type: Boolean
  },
  'gamertag': {
    type: String
  },
  'lastModified': {
    type: Date
  },
  'joined': {
    default: Date.now(),
    required: true,
    type: Date
  },
  'netlog': {
    type: {
      'commanderId': {
        type: String
      },
      'userId': {
        type: String
      }
    }
  },
  'nickname': {
    type: String
  }
});

RatSchema.index({
  'CMDRname': 'text',
  'gamertag': 'text',
  'nickname': 'text'
});

RatSchema.pre( 'save', function ( next ) {
  var timestamp;

  timestamp = Date.now();

  this.createdAt = this.createdAt || timestamp;
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
