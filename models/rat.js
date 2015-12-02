var mongoose, RatSchema, Schema;

mongoose = require( 'mongoose' );
Schema = mongoose.Schema;

RatSchema = new Schema({
  'CMDRname': {
    type: String
  },
  'createdAt': {
    type: Date
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
  'nickname': {
    type: String
  },
  'drilled': {
    default: false,
    type: Boolean
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
